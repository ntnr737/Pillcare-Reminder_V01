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

const BG="#161826",SF="#232532",TX="#e9e9ed",TM="rgba(233,233,237,0.5)",TD="rgba(233,233,237,0.3)",AC="#9184d9",AL="#a7a1db",AB="rgba(145,132,217,0.16)";

const CACHE_KEY=(date:string)=>`pillcare_doses_${date}`;
const PROFILE_KEY="pillcare_profile_cache";
const STREAK_KEY="pillcare_streak_cache";

function todayStr(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function getWeekDays(c:string){const b=new Date(c),dy=b.getDay(),mn=new Date(b);mn.setDate(b.getDate()-((dy+6)%7));return Array.from({length:7},(_,i)=>{const d=new Date(mn);d.setDate(mn.getDate()+i);return{lbl:["MON","TUE","WED","THU","FRI","SAT","SUN"][i],num:d.getDate(),iso:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};});}
function greeting(){const h=new Date().getHours();return h<12?"Good morning":h<17?"Good afternoon":"Good evening";}
function getSec(t:string){const[h]=t.split(":").map(Number);return h<12?"morning":h<17?"afternoon":h<21?"evening":"night";}
const SICO:any={morning:"sunny-outline",afternoon:"partly-sunny-outline",evening:"moon-outline",night:"moon-outline"};

function Ring({pct}:{pct:number}){const R=32,C=2*Math.PI*R,off=C-(pct/100)*C;return(<View style={{width:80,height:80,alignItems:"center",justifyContent:"center"}}><Svg width={80}height={80}viewBox="0 0 80 80"style={{position:"absolute"}}><Circle cx={40}cy={40}r={R}fill="none"stroke={AB}strokeWidth={7}/><Circle cx={40}cy={40}r={R}fill="none"stroke={AC}strokeWidth={7}strokeDasharray={`${C}`}strokeDashoffset={off}strokeLinecap="round"rotation={-90}origin="40,40"/></Svg><Text style={{color:TX,fontSize:14,fontWeight:"700"}}>{pct}%</Text></View>);}

export default function Today(){
  const[date,setDate]=useState(todayStr());
  const[doses,setDoses]=useState<any[]>([]);
  const[profile,setProfile]=useState<any>(null);
  const[aiMsg,setAiMsg]=useState<string|null>(null);
  const[streak,setStreak]=useState(0);
  const[sheet,setSheet]=useState(false);
  const[refreshing,setRefreshing]=useState(false);
  const days=getWeekDays(date);

  // Load cache instantly on mount for perceived speed
  useEffect(()=>{
    AsyncStorage.getItem(CACHE_KEY(date)).then(raw=>{if(raw)try{setDoses(JSON.parse(raw));}catch{}});
    AsyncStorage.getItem(PROFILE_KEY).then(raw=>{if(raw)try{setProfile(JSON.parse(raw));}catch{}});
    AsyncStorage.getItem(STREAK_KEY).then(raw=>{if(raw)setStreak(parseInt(raw)||0);});
  },[date]);

  const load=useCallback(async()=>{
    try{
      const[d,p,a]=await Promise.all([api.listDoses(date),api.getProfile(),api.adherence(7)]);
      const doses=d||[];
      setDoses(doses);setProfile(p);setStreak(a?.streak||0);
      // Update cache
      AsyncStorage.setItem(CACHE_KEY(date),JSON.stringify(doses));
      AsyncStorage.setItem(PROFILE_KEY,JSON.stringify(p));
      AsyncStorage.setItem(STREAK_KEY,String(a?.streak||0));
    }catch{}
  },[date]);

  const loadAI=useCallback(async()=>{try{const r=await api.dailyMessage();setAiMsg(r.message);if(r.streak)setStreak(r.streak);}catch{}},[]);
  useFocusEffect(useCallback(()=>{load();loadAI();},[load,loadAI]));
  const onRefresh=async()=>{setRefreshing(true);await load();setRefreshing(false);};

  // Optimistic update: update UI immediately, sync to server in background
  const mark=async(id:string,cur:string)=>{
    const nx=cur==="pending"?"taken":cur==="taken"?"skipped":"pending";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Instantly update local state
    setDoses(prev=>{
      const updated=prev.map(d=>d.id===id?{...d,status:nx}:d);
      AsyncStorage.setItem(CACHE_KEY(date),JSON.stringify(updated));
      return updated;
    });
    // Sync to server in background
    api.setDoseStatus(id,nx).then(()=>{
      load();resyncReminders().catch(()=>{});
    }).catch(()=>{
      // Revert on failure
      setDoses(prev=>prev.map(d=>d.id===id?{...d,status:cur}:d));
    });
  };

  const taken=doses.filter(d=>d.status==="taken").length,total=doses.length,pct=total>0?Math.round((taken/total)*100):0;
  const title=total===0?"Add your first med":taken===total?"All done today! \U0001F389":taken===0?"Let's get started":"Almost there!";
  const next=doses.filter(d=>d.status==="pending").sort((a,b)=>a.scheduled_time.localeCompare(b.scheduled_time))[0];
  const secs:Record<string,any[]>={};
  for(const d of doses){const sc=getSec(d.scheduled_time);if(!secs[sc])secs[sc]=[];secs[sc].push(d);}

  return(
    <SafeAreaView style={s.safe}edges={["top"]}>
      <View style={s.hdr}>
        <View><Text style={s.gr}>{greeting()},</Text><Text style={s.nm}>{profile?.nickname||"Friend"} \U0001F44B</Text></View>
        <TouchableOpacity style={s.addBtn}onPress={()=>setSheet(true)}><Ionicons name="add"size={22}color={AL}/></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.body}showsVerticalScrollIndicator={false}refreshControl={<RefreshControl refreshing={refreshing}onRefresh={onRefresh}tintColor={AC}/>}>
        <View style={s.ov}>
          <View style={{flex:1}}>
            <Text style={s.kicker}>OVERVIEW</Text>
            <Text style={s.ovTitle}>{title}</Text>
            {next?<Text style={s.ovSub}>Next: <Text style={{color:TX}}>{next.medication?.name}</Text> at {next.scheduled_time}</Text>:total>0?<Text style={s.ovSub}>All doses accounted for</Text>:null}
            <View style={s.metaRow}><Ionicons name="flame-outline"size={13}color={AL}/><Text style={s.metaTx}>Streak: <Text style={{color:TX,fontWeight:"700"}}>{streak} days</Text></Text></View>
          </View>
          <Ring pct={pct}/>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}contentContainerStyle={s.strip}>
          {days.map(d=>{const a=d.iso===date;return(<TouchableOpacity key={d.iso}onPress={()=>setDate(d.iso)}style={[s.pill,a&&s.pillOn]}><Text style={[s.pLbl,a&&s.pLblOn]}>{d.lbl}</Text><Text style={[s.pNum,a&&s.pNumOn]}>{d.num}</Text></TouchableOpacity>);})}
        </ScrollView>
        {total===0?(<View style={s.empty}><Ionicons name="medical-outline"size={32}color={AC}/><Text style={s.emTitle}>No medications yet</Text><Text style={s.emSub}>Tap + to add your first medication</Text></View>
        ):["morning","afternoon","evening","night"].map(sec=>{const items=secs[sec];if(!items?.length)return null;return(<View key={sec}><View style={s.secHdr}><View style={s.secIco}><Ionicons name={SICO[sec]}size={13}color={AL}/></View><Text style={s.secLbl}>{sec.toUpperCase()}</Text><Text style={s.secTm}>{items[0]?.scheduled_time}</Text></View>{items.map(dose=>{const m=dose.medication||{},st=dose.status||"pending";const bSt=st==="taken"?s.bTaken:st==="skipped"||st==="missed"?s.bSkip:s.bPend;const bTx=st==="taken"?{color:AL}:st!=="pending"?{color:"#e58585"}:{color:"#fff"};const lbl=st==="taken"?"Taken":st==="skipped"?"Skipped":st==="missed"?"Missed":"Take";return(<TouchableOpacity key={dose.id}style={s.dc}onPress={()=>mark(dose.id,st)}activeOpacity={0.85}><View style={s.dIco}><Ionicons name="medical-outline"size={17}color={AL}/></View><View style={{flex:1}}><Text style={s.dNm}>{m.name||"Unknown"}</Text><Text style={s.dMeta}>{m.dosage?`${m.dosage} ${m.unit}`:m.unit||""} \u2022 {dose.scheduled_time}</Text></View><TouchableOpacity style={[s.dBtn,bSt]}onPress={()=>mark(dose.id,st)}><Text style={[s.dBtnTx,bTx]}>{lbl}</Text></TouchableOpacity></TouchableOpacity>);})}</View>);})}
        {aiMsg&&(<View style={s.ai}><View style={s.aiIco}><Ionicons name="sparkles-outline"size={13}color={AL}/></View><View style={{flex:1}}><Text style={s.aiK}>AI INSIGHT</Text><Text style={s.aiTx}>{aiMsg}</Text></View></View>)}
      </ScrollView>
      <AddMedicationSheet visible={sheet}onClose={()=>setSheet(false)}onSaved={()=>{setSheet(false);load();resyncReminders().catch(()=>{});}}/>
    </SafeAreaView>
  );
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:BG},hdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingTop:10,paddingBottom:4},gr:{fontSize:13,color:TM},nm:{fontSize:22,fontWeight:"700",color:TX,letterSpacing:-0.4},addBtn:{width:36,height:36,borderRadius:18,backgroundColor:AB,alignItems:"center",justifyContent:"center"},body:{paddingBottom:100},ov:{margin:16,marginBottom:8,backgroundColor:SF,borderRadius:18,padding:16,flexDirection:"row",alignItems:"center"},kicker:{fontSize:10,letterSpacing:1,textTransform:"uppercase",color:AL,marginBottom:6},ovTitle:{fontSize:21,fontWeight:"700",color:TX,letterSpacing:-0.4},ovSub:{fontSize:12,color:TM,marginTop:4},metaRow:{flexDirection:"row",alignItems:"center",gap:4,marginTop:8},metaTx:{fontSize:11,color:TM},strip:{paddingHorizontal:16,paddingVertical:10,gap:6},pill:{width:46,height:58,borderRadius:14,alignItems:"center",justifyContent:"center",gap:2,borderWidth:1,borderColor:"rgba(233,233,237,0.1)"},pillOn:{backgroundColor:AC,borderColor:AC},pLbl:{fontSize:9,letterSpacing:0.6,textTransform:"uppercase",color:TD,fontWeight:"600"},pLblOn:{color:"rgba(255,255,255,0.7)"},pNum:{fontSize:17,fontWeight:"700",color:TX},pNumOn:{color:"#fff"},secHdr:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:16,paddingTop:10,paddingBottom:6},secIco:{width:26,height:26,borderRadius:13,backgroundColor:AB,alignItems:"center",justifyContent:"center"},secLbl:{fontSize:10,letterSpacing:0.6,color:TM,fontWeight:"600"},secTm:{marginLeft:"auto",fontSize:11,color:AC,fontWeight:"600"},dc:{marginHorizontal:16,marginBottom:8,backgroundColor:SF,borderRadius:14,padding:12,flexDirection:"row",alignItems:"center",gap:12},dIco:{width:38,height:38,borderRadius:12,backgroundColor:AB,alignItems:"center",justifyContent:"center"},dNm:{fontSize:14,fontWeight:"600",color:TX},dMeta:{fontSize:11,color:TM,marginTop:2},dBtn:{height:30,paddingHorizontal:14,borderRadius:8,alignItems:"center",justifyContent:"center"},bPend:{backgroundColor:AC},bTaken:{backgroundColor:AB},bSkip:{backgroundColor:"rgba(229,133,133,0.15)"},dBtnTx:{fontSize:11,fontWeight:"700"},empty:{margin:16,backgroundColor:SF,borderRadius:18,padding:32,alignItems:"center",gap:8},emTitle:{fontSize:16,fontWeight:"700",color:TX},emSub:{fontSize:13,color:TM,textAlign:"center"},ai:{margin:16,marginTop:4,backgroundColor:SF,borderRadius:14,padding:14,flexDirection:"row",gap:10},aiIco:{width:28,height:28,borderRadius:14,backgroundColor:AB,alignItems:"center",justifyContent:"center"},aiK:{fontSize:9,letterSpacing:0.8,textTransform:"uppercase",color:AL,fontWeight:"600"},aiTx:{fontSize:12,color:TM,lineHeight:17,marginTop:3}});
