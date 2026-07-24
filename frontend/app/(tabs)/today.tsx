import{useCallback,useEffect,useState}from"react";
import{View,Text,StyleSheet,ScrollView,TouchableOpacity,RefreshControl}from"react-native";
import{SafeAreaView}from"react-native-safe-area-context";
import{Ionicons}from"@expo/vector-icons";
import{useFocusEffect}from"expo-router";
import*as Haptics from"expo-haptics";
import AsyncStorage from"@react-native-async-storage/async-storage";
import Svg,{Circle}from"react-native-svg";
import{AddMedicationSheet}from"@/src/components/AddMedicationSheet";
import{api}from"@/src/lib/api";
import{resyncReminders}from"@/src/lib/notifications";

const BG="#161826",SF="#232532",TX="#e9e9ed",TM="rgba(233,233,237,0.5)",TD="rgba(233,233,237,0.3)",AC="#9184d9",AL="#a7a1db",AB="rgba(145,132,217,0.18)",AB2="rgba(145,132,217,0.12)",BORDER="rgba(233,233,237,0.12)";
const CACHE_DOSES=(d:string)=>`pc_doses_${d}`,CACHE_PROFILE="pc_profile",CACHE_STREAK="pc_streak";

function todayStr(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function getWeekDays(c:string){const b=new Date(c),dy=b.getDay(),mn=new Date(b);mn.setDate(b.getDate()-((dy+6)%7));return Array.from({length:7},(_,i)=>{const d=new Date(mn);d.setDate(mn.getDate()+i);return{lbl:["MON","TUE","WED","THU","FRI","SAT","SUN"][i],num:d.getDate(),iso:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};});}
function greeting(){const h=new Date().getHours();return h<12?"Good morning":h<17?"Good afternoon":"Good evening";}
function getSec(t:string){const[h]=t.split(":").map(Number);return h<12?"morning":h<17?"afternoon":h<21?"evening":"night";}
const SICO:any={morning:"sunny-outline",afternoon:"partly-sunny-outline",evening:"moon-outline",night:"moon-outline"};

function Ring({pct}:{pct:number}){
  const R=34,C=2*Math.PI*R,off=C-(pct/100)*C;
  return(
    <View style={{width:88,height:88,alignItems:"center",justifyContent:"center"}}>
      <Svg width={88}height={88}viewBox="0 0 88 88"style={{position:"absolute"}}>
        <Circle cx={44}cy={44}r={R}fill="none"stroke={AB}strokeWidth={8}/>
        <Circle cx={44}cy={44}r={R}fill="none"stroke={AC}strokeWidth={8}strokeDasharray={`${C}`}strokeDashoffset={off}strokeLinecap="round"rotation={-90}origin="44,44"/>
      </Svg>
      <Text style={{color:TX,fontSize:15,fontWeight:"700"}}>{pct}%</Text>
      <Text style={{color:TM,fontSize:9}}>today</Text>
    </View>
  );
}

export default function Today(){
  const[date,setDate]=useState(todayStr());
  const[doses,setDoses]=useState<any[]>([]);
  const[profile,setProfile]=useState<any>(null);
  const[aiMsg,setAiMsg]=useState<string|null>(null);
  const[streak,setStreak]=useState(0);
  const[sheet,setSheet]=useState(false);
  const[refreshing,setRefreshing]=useState(false);
  const days=getWeekDays(date);

  useEffect(()=>{
    AsyncStorage.getItem(CACHE_DOSES(date)).then(r=>{if(r)try{setDoses(JSON.parse(r));}catch{}});
    AsyncStorage.getItem(CACHE_PROFILE).then(r=>{if(r)try{setProfile(JSON.parse(r));}catch{}});
    AsyncStorage.getItem(CACHE_STREAK).then(r=>{if(r)setStreak(parseInt(r)||0);});
  },[date]);

  const load=useCallback(async()=>{
    try{
      const[d,p,a]=await Promise.all([api.listDoses(date),api.getProfile(),api.adherence(7)]);
      const ds=d||[];setDoses(ds);setProfile(p);setStreak(a?.streak||0);
      AsyncStorage.setItem(CACHE_DOSES(date),JSON.stringify(ds));
      AsyncStorage.setItem(CACHE_PROFILE,JSON.stringify(p));
      AsyncStorage.setItem(CACHE_STREAK,String(a?.streak||0));
    }catch{}
  },[date]);

  const loadAI=useCallback(async()=>{try{const r=await api.dailyMessage();setAiMsg(r.message);if(r.streak)setStreak(r.streak);}catch{}},[]);
  useFocusEffect(useCallback(()=>{load();loadAI();},[load,loadAI]));
  const onRefresh=async()=>{setRefreshing(true);await load();setRefreshing(false);};

  const mark=async(id:string,cur:string)=>{
    const nx=cur==="pending"?"taken":cur==="taken"?"skipped":"pending";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDoses(prev=>{const u=prev.map(d=>d.id===id?{...d,status:nx}:d);AsyncStorage.setItem(CACHE_DOSES(date),JSON.stringify(u));return u;});
    api.setDoseStatus(id,nx).then(()=>load()).catch(()=>setDoses(prev=>prev.map(d=>d.id===id?{...d,status:cur}:d)));
  };

  const taken=doses.filter(d=>d.status==="taken").length,total=doses.length,pct=total>0?Math.round((taken/total)*100):0;
  const title=total===0?"Add your first med":taken===total?"All done! \U0001F389":taken===0?"Let's get started":"Almost there!";
  const next=doses.filter(d=>d.status==="pending").sort((a,b)=>a.scheduled_time.localeCompare(b.scheduled_time))[0];
  const secs:Record<string,any[]>={};
  for(const d of doses){const sc=getSec(d.scheduled_time);if(!secs[sc])secs[sc]=[];secs[sc].push(d);}

  return(
    <SafeAreaView style={s.safe}edges={["top"]}>
      <View style={s.hdr}>
        <View>
          <Text style={s.gr}>{greeting()},</Text>
          <Text style={s.nm}>{profile?.nickname||"Friend"} \U0001F44B</Text>
        </View>
        <TouchableOpacity style={s.addBtn}onPress={()=>setSheet(true)}>
          <Ionicons name="add"size={22}color={AL}/>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body}showsVerticalScrollIndicator={false}refreshControl={<RefreshControl refreshing={refreshing}onRefresh={onRefresh}tintColor={AC}/>}>
        {/* Overview Card */}
        <View style={s.ov}>
          <View style={{flex:1,gap:4}}>
            <Text style={s.kicker}>OVERVIEW</Text>
            <Text style={s.ovTitle}>{title}</Text>
            {next?<Text style={s.ovSub}>Next: <Text style={{color:TX,fontWeight:"600"}}>{next.medication?.name}</Text> at {next.scheduled_time}</Text>:total>0?<Text style={s.ovSub}>All doses complete</Text>:null}
            <View style={s.metaRow}>
              <Ionicons name="flame"size={13}color="#f4845f"/>
              <Text style={s.metaTx}><Text style={{color:TX,fontWeight:"700"}}>{streak}</Text> day streak</Text>
            </View>
          </View>
          <Ring pct={pct}/>
        </View>

        {/* Week strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}contentContainerStyle={s.strip}>
          {days.map(d=>{const a=d.iso===date;return(
            <TouchableOpacity key={d.iso}onPress={()=>setDate(d.iso)}style={[s.pill,a&&s.pillOn]}>
              <Text style={[s.pLbl,a&&s.pLblOn]}>{d.lbl}</Text>
              <Text style={[s.pNum,a&&s.pNumOn]}>{d.num}</Text>
            </TouchableOpacity>
          );})}
        </ScrollView>

        {/* Doses */}
        {total===0?(
          <View style={s.empty}>
            <View style={s.emIco}><Ionicons name="medical-outline"size={28}color={AC}/></View>
            <Text style={s.emTitle}>No medications yet</Text>
            <Text style={s.emSub}>Tap + to add your first medication</Text>
          </View>
        ):["morning","afternoon","evening","night"].map(sec=>{
          const items=secs[sec];if(!items?.length)return null;
          return(
            <View key={sec}>
              <View style={s.secHdr}>
                <View style={s.secIco}><Ionicons name={SICO[sec]}size={13}color={AL}/></View>
                <Text style={s.secLbl}>{sec.toUpperCase()}</Text>
                <View style={s.secLine}/>
                <Text style={s.secTm}>{items[0]?.scheduled_time}</Text>
              </View>
              {items.map(dose=>{
                const m=dose.medication||{},st=dose.status||"pending";
                const taken=st==="taken",skipped=st==="skipped"||st==="missed";
                const lbl=taken?"Taken":skipped?"Skipped":"Take";
                return(
                  <TouchableOpacity key={dose.id}style={[s.dc,taken&&s.dcTaken]}onPress={()=>mark(dose.id,st)}activeOpacity={0.85}>
                    <View style={[s.dIco,taken&&s.dIcoTaken]}>
                      <Ionicons name="medical-outline"size={16}color={taken?AC:AL}/>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={[s.dNm,taken&&{color:TM}]}>{m.name||"Unknown"}</Text>
                      <Text style={s.dMeta}>{m.dosage?`${m.dosage} ${m.unit}`:m.unit||""}{m.dosage?" \u2022 ":""}{dose.scheduled_time}</Text>
                    </View>
                    <TouchableOpacity style={[s.dBtn,taken?s.dBtnTaken:skipped?s.dBtnSkip:s.dBtnPend]}onPress={()=>mark(dose.id,st)}>
                      {taken&&<Ionicons name="checkmark"size={12}color={AC}style={{marginRight:3}}/>}
                      <Text style={[s.dBtnTx,taken?{color:AC}:skipped?{color:"#e58585"}:{color:"#fff"}]}>{lbl}</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {/* AI insight */}
        {aiMsg&&(
          <View style={s.ai}>
            <View style={s.aiIco}><Ionicons name="sparkles-outline"size={13}color={AL}/></View>
            <View style={{flex:1}}>
              <Text style={s.aiK}>AI INSIGHT</Text>
              <Text style={s.aiTx}>{aiMsg}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <AddMedicationSheet visible={sheet}onClose={()=>setSheet(false)}onSaved={()=>{setSheet(false);load();resyncReminders().catch(()=>{});}}/>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:BG},
  hdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:18,paddingTop:10,paddingBottom:6},
  gr:{fontSize:12,color:TM,letterSpacing:0.2},
  nm:{fontSize:23,fontWeight:"700",color:TX,letterSpacing:-0.5,marginTop:1},
  addBtn:{width:38,height:38,borderRadius:19,backgroundColor:AB,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:BORDER},
  body:{paddingBottom:110},
  ov:{margin:18,marginBottom:6,backgroundColor:SF,borderRadius:20,padding:18,flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:BORDER},
  kicker:{fontSize:10,letterSpacing:1.2,textTransform:"uppercase",color:AL,fontWeight:"600"},
  ovTitle:{fontSize:20,fontWeight:"700",color:TX,letterSpacing:-0.4,lineHeight:24},
  ovSub:{fontSize:12,color:TM,lineHeight:16},
  metaRow:{flexDirection:"row",alignItems:"center",gap:4,marginTop:6},
  metaTx:{fontSize:11,color:TM},
  strip:{paddingHorizontal:18,paddingVertical:10,gap:7},
  pill:{width:48,height:62,borderRadius:16,alignItems:"center",justifyContent:"center",gap:3,borderWidth:1.5,borderColor:BORDER},
  pillOn:{backgroundColor:AB,borderColor:AC},
  pLbl:{fontSize:9,letterSpacing:0.8,textTransform:"uppercase",color:TD,fontWeight:"700"},
  pLblOn:{color:AL},
  pNum:{fontSize:18,fontWeight:"700",color:TX},
  pNumOn:{color:AL},
  secHdr:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:18,paddingTop:14,paddingBottom:8},
  secIco:{width:24,height:24,borderRadius:12,backgroundColor:AB2,alignItems:"center",justifyContent:"center"},
  secLbl:{fontSize:10,letterSpacing:0.8,color:TM,fontWeight:"700"},
  secLine:{flex:1,height:1,backgroundColor:BORDER},
  secTm:{fontSize:11,color:AC,fontWeight:"600"},
  dc:{marginHorizontal:18,marginBottom:8,backgroundColor:SF,borderRadius:16,padding:14,flexDirection:"row",alignItems:"center",gap:12,borderWidth:1,borderColor:BORDER},
  dcTaken:{backgroundColor:"rgba(35,37,50,0.6)",borderColor:"rgba(233,233,237,0.06)"},
  dIco:{width:40,height:40,borderRadius:13,backgroundColor:AB,alignItems:"center",justifyContent:"center"},
  dIcoTaken:{backgroundColor:"rgba(145,132,217,0.08)"},
  dNm:{fontSize:14,fontWeight:"600",color:TX},
  dMeta:{fontSize:11,color:TM,marginTop:2},
  dBtn:{flexDirection:"row",alignItems:"center",height:32,paddingHorizontal:14,borderRadius:10,justifyContent:"center"},
  dBtnPend:{backgroundColor:AC},
  dBtnTaken:{backgroundColor:AB2,borderWidth:1,borderColor:"rgba(145,132,217,0.25)"},
  dBtnSkip:{backgroundColor:"rgba(229,133,133,0.12)"},
  dBtnTx:{fontSize:12,fontWeight:"700"},
  empty:{margin:18,backgroundColor:SF,borderRadius:20,padding:36,alignItems:"center",gap:10,borderWidth:1,borderColor:BORDER},
  emIco:{width:56,height:56,borderRadius:28,backgroundColor:AB,alignItems:"center",justifyContent:"center"},
  emTitle:{fontSize:16,fontWeight:"700",color:TX},
  emSub:{fontSize:13,color:TM,textAlign:"center",lineHeight:18},
  ai:{margin:18,marginTop:4,backgroundColor:"rgba(145,132,217,0.08)",borderRadius:16,padding:14,flexDirection:"row",gap:10,borderWidth:1,borderColor:"rgba(145,132,217,0.2)"},
  aiIco:{width:28,height:28,borderRadius:14,backgroundColor:AB,alignItems:"center",justifyContent:"center"},
  aiK:{fontSize:9,letterSpacing:1,textTransform:"uppercase",color:AL,fontWeight:"700"},
  aiTx:{fontSize:12,color:TM,lineHeight:17,marginTop:3},
});
