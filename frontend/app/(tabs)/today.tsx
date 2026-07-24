import{useCallback,useEffect,useState}from"react";
import{View,Text,StyleSheet,ScrollView,TouchableOpacity,RefreshControl,Modal}from"react-native";
import{SafeAreaView}from"react-native-safe-area-context";
import{Ionicons}from"@expo/vector-icons";
import{useFocusEffect}from"expo-router";
import*as Haptics from"expo-haptics";
import AsyncStorage from"@react-native-async-storage/async-storage";
import Svg,{Circle}from"react-native-svg";
import{AddMedicationSheet}from"@/src/components/AddMedicationSheet";
import{api}from"@/src/lib/api";
import{resyncReminders}from"@/src/lib/notifications";

const BG="#161826",SF="#232532",SF2="#3f424d",TX="#e9e9ed",TM="rgba(233,233,237,0.55)",TD="rgba(233,233,237,0.3)",AC="#9184d9",AL="#a7a1db",AB="rgba(145,132,217,0.16)",AB2="rgba(145,132,217,0.14)",BORDER="rgba(233,233,237,0.1)";
const CACHE_D=(d:string)=>`pc2_doses_${d}`,CACHE_P="pc2_profile",CACHE_S="pc2_streak";

function todayStr(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function getWeekDays(c:string){const b=new Date(c),dy=b.getDay(),mn=new Date(b);mn.setDate(b.getDate()-((dy+6)%7));return Array.from({length:7},(_,i)=>{const d=new Date(mn);d.setDate(mn.getDate()+i);return{lbl:["MON","TUE","WED","THU","FRI","SAT","SUN"][i],num:d.getDate(),iso:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};});}
function getSec(t:string){const[h]=t.split(":").map(Number);return h<12?"morning":h<17?"afternoon":h<21?"evening":"night";}
const SICO:any={morning:"sunny-outline",afternoon:"partly-sunny-outline",evening:"moon-outline",night:"moon-outline"};
const SLBL:any={morning:"MORNING",afternoon:"AFTERNOON",evening:"EVENING",night:"NIGHT"};

function Ring({pct}:{pct:number}){const R=30,C=2*Math.PI*R,off=C-(pct/100)*C;return(<View style={{width:76,height:76,alignItems:"center",justifyContent:"center"}}><Svg width={76}height={76}viewBox="0 0 76 76"style={{position:"absolute"}}><Circle cx={38}cy={38}r={R}fill="none"stroke="rgba(145,132,217,0.18)"strokeWidth={7}/><Circle cx={38}cy={38}r={R}fill="none"stroke={AC}strokeWidth={7}strokeDasharray={`${C}`}strokeDashoffset={off}strokeLinecap="round"rotation={-90}origin="38,38"/></Svg><Text style={{color:TX,fontSize:14,fontWeight:"700"}}>{pct}%</Text></View>);}

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
    AsyncStorage.getItem(CACHE_D(date)).then(r=>{if(r)try{setDoses(JSON.parse(r));}catch{}});
    AsyncStorage.getItem(CACHE_P).then(r=>{if(r)try{setProfile(JSON.parse(r));}catch{}});
    AsyncStorage.getItem(CACHE_S).then(r=>{if(r)setStreak(parseInt(r)||0);});
  },[date]);

  const load=useCallback(async()=>{
    try{
      const[d,p,a]=await Promise.all([api.listDoses(date),api.getProfile(),api.adherence(7)]);
      const ds=d||[];setDoses(ds);setProfile(p);setStreak(a?.streak||0);
      AsyncStorage.setItem(CACHE_D(date),JSON.stringify(ds));
      AsyncStorage.setItem(CACHE_P,JSON.stringify(p));
      AsyncStorage.setItem(CACHE_S,String(a?.streak||0));
    }catch{}
  },[date]);

  const loadAI=useCallback(async()=>{try{const r=await api.dailyMessage();setAiMsg(r.message);if(r.streak)setStreak(r.streak);}catch{}},[]);
  useFocusEffect(useCallback(()=>{load();loadAI();},[load,loadAI]));
  const onRefresh=async()=>{setRefreshing(true);await load();setRefreshing(false);};

  const mark=async(id:string,cur:string)=>{
    const nx=cur==="pending"?"taken":cur==="taken"?"skipped":"pending";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDoses(prev=>{const u=prev.map(d=>d.id===id?{...d,status:nx}:d);AsyncStorage.setItem(CACHE_D(date),JSON.stringify(u));return u;});
    api.setDoseStatus(id,nx).then(()=>load()).catch(()=>setDoses(prev=>prev.map(d=>d.id===id?{...d,status:cur}:d)));
    resyncReminders().catch(()=>{});
  };

  const taken=doses.filter(d=>d.status==="taken").length,total=doses.length,pct=total>0?Math.round((taken/total)*100):0;
  const next=doses.filter(d=>d.status==="pending").sort((a,b)=>a.scheduled_time.localeCompare(b.scheduled_time))[0];
  const secs:Record<string,any[]>={};
  for(const d of doses){const sc=getSec(d.scheduled_time);if(!secs[sc])secs[sc]=[];secs[sc].push(d);}

  return(
    <SafeAreaView style={s.safe}edges={["top"]}>
      {/* Header */}
      <View style={s.hdr}>
        <Text style={s.appName}>PillCare</Text>
        <View style={s.hdrRight}>
          <View style={s.streakBadge}>
            <Ionicons name="flame"size={12}color={AL}/>
            <Text style={s.streakTx}>{streak}</Text>
          </View>
          <TouchableOpacity style={s.iconBtn}onPress={()=>setSheet(true)}>
            <Ionicons name="add"size={20}color={TX}/>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body}showsVerticalScrollIndicator={false}refreshControl={<RefreshControl refreshing={refreshing}onRefresh={onRefresh}tintColor={AC}/>}>

        {/* Overview card */}
        <View style={s.ov}>
          <View style={{flex:1,gap:5}}>
            <Text style={s.ovTitle}>{total===0?"Add your first med":taken===total?"All done! \U0001F389":taken===0?"Let's get started":"Almost there!"}</Text>
            {next?<Text style={s.ovSub}>Next: <Text style={{color:TX,fontWeight:"600"}}>{next.medication?.name}</Text> at {next.scheduled_time}</Text>:total>0?<Text style={s.ovSub}>All doses complete</Text>:null}
            <View style={s.metaRow}>
              <Ionicons name="flame"size={12}color="#f4845f"/>
              <Text style={s.metaTx}><Text style={{color:TX,fontWeight:"600"}}>{streak}</Text> day streak</Text>
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

        {/* Dose sections */}
        {total===0?(
          <View style={s.empty}>
            <View style={s.emIco}><Ionicons name="medical-outline"size={26}color={AC}/></View>
            <Text style={s.emTitle}>No medications yet</Text>
            <Text style={s.emSub}>Tap + to add your first medication</Text>
          </View>
        ):["morning","afternoon","evening","night"].map(sec=>{
          const items=secs[sec];if(!items?.length)return null;
          return(
            <View key={sec}style={{marginBottom:4}}>
              <View style={s.secHdr}>
                <Ionicons name={SICO[sec]}size={12}color={AL}/>
                <Text style={s.secLbl}>{SLBL[sec]} • {items[0]?.scheduled_time}</Text>
              </View>
              {items.map(dose=>{
                const m=dose.medication||{},st=dose.status||"pending";
                const taken=st==="taken",skipped=st==="skipped"||st==="missed";
                return(
                  <View key={dose.id}style={[s.dc,taken&&s.dcDim]}>
                    <View style={[s.dIco,taken&&{backgroundColor:"rgba(145,132,217,0.08)"}]}>
                      <Ionicons name="medical-outline"size={16}color={taken?TM:AL}/>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={[s.dNm,taken&&{color:TM}]}>{m.name||"Unknown"}</Text>
                      <Text style={s.dMeta}>{m.dosage?`${m.dosage} ${m.unit}`:m.unit||""}{m.dosage?" • ":""}{dose.scheduled_time}</Text>
                    </View>
                    <TouchableOpacity style={[s.dBtn,taken?s.bTaken:skipped?s.bSkip:s.bPend]}onPress={()=>mark(dose.id,st)}>
                      {taken&&<Ionicons name="checkmark"size={11}color={AL}style={{marginRight:2}}/>}
                      <Text style={[s.dBtnTx,taken?{color:AL}:skipped?{color:"#e58585"}:{color:"#fff"}]}>{taken?"Taken":skipped?"Skipped":"Take"}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* AI Yoga card */}
        {aiMsg&&(
          <View style={s.aiCard}>
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
  hdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:18,paddingTop:12,paddingBottom:8},
  appName:{fontSize:18,fontWeight:"600",color:TX,letterSpacing:-.3},
  hdrRight:{flexDirection:"row",alignItems:"center",gap:8},
  streakBadge:{flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:10,paddingVertical:4,borderRadius:999,borderWidth:1,borderColor:BORDER,backgroundColor:AB2},
  streakTx:{fontSize:13,fontWeight:"600",color:AL},
  iconBtn:{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:BORDER,alignItems:"center",justifyContent:"center"},
  body:{paddingBottom:110},
  ov:{margin:18,marginBottom:6,backgroundColor:SF,borderRadius:18,padding:16,flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:BORDER},
  ovTitle:{fontSize:20,fontWeight:"700",color:TX,letterSpacing:-.4},
  ovSub:{fontSize:12,color:TM},
  metaRow:{flexDirection:"row",alignItems:"center",gap:4,marginTop:2},
  metaTx:{fontSize:11,color:TM},
  strip:{paddingHorizontal:18,paddingVertical:10,gap:6},
  pill:{width:46,height:60,borderRadius:14,alignItems:"center",justifyContent:"center",gap:2,borderWidth:1,borderColor:BORDER},
  pillOn:{backgroundColor:AB,borderColor:AC},
  pLbl:{fontSize:9,letterSpacing:.6,textTransform:"uppercase",color:TD,fontWeight:"700"},
  pLblOn:{color:AL},
  pNum:{fontSize:17,fontWeight:"700",color:TX},
  pNumOn:{color:AL},
  secHdr:{flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:18,paddingTop:10,paddingBottom:7},
  secLbl:{fontSize:10,letterSpacing:.6,color:TM,fontWeight:"600"},
  dc:{marginHorizontal:18,marginBottom:8,backgroundColor:SF,borderRadius:14,padding:13,flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:BORDER},
  dcDim:{backgroundColor:"rgba(35,37,50,0.5)",borderColor:"rgba(233,233,237,0.06)"},
  dIco:{width:36,height:36,borderRadius:10,backgroundColor:AB,alignItems:"center",justifyContent:"center"},
  dNm:{fontSize:13,fontWeight:"600",color:TX},
  dMeta:{fontSize:10,color:TM,marginTop:2},
  dBtn:{flexDirection:"row",alignItems:"center",height:30,paddingHorizontal:12,borderRadius:8,justifyContent:"center"},
  bPend:{backgroundColor:AC},
  bTaken:{backgroundColor:"rgba(145,132,217,0.12)",borderWidth:1,borderColor:"rgba(145,132,217,0.2)"},
  bSkip:{backgroundColor:"rgba(229,133,133,0.12)"},
  dBtnTx:{fontSize:11,fontWeight:"700"},
  empty:{margin:18,backgroundColor:SF,borderRadius:18,padding:36,alignItems:"center",gap:10,borderWidth:1,borderColor:BORDER},
  emIco:{width:52,height:52,borderRadius:26,backgroundColor:AB,alignItems:"center",justifyContent:"center",marginBottom:4},
  emTitle:{fontSize:15,fontWeight:"700",color:TX},
  emSub:{fontSize:12,color:TM,textAlign:"center"},
  aiCard:{margin:18,marginTop:4,backgroundColor:"rgba(145,132,217,0.07)",borderRadius:14,padding:13,flexDirection:"row",gap:10,borderWidth:1,borderColor:"rgba(145,132,217,0.22)"},
  aiIco:{width:26,height:26,borderRadius:13,backgroundColor:AB,alignItems:"center",justifyContent:"center"},
  aiK:{fontSize:9,letterSpacing:1,textTransform:"uppercase",color:AL,fontWeight:"700"},
  aiTx:{fontSize:11,color:TM,lineHeight:16,marginTop:3},
});
