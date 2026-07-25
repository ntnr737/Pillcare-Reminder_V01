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

const BG="#161826",SF="#232532",N800="#3f424d",TX="#e9e9ed",TM="rgba(233,233,237,0.55)",TD="rgba(233,233,237,0.35)",AC="#9184d9",A3="#a7a1db",AB="rgba(145,132,217,0.14)",BORDER="rgba(233,233,237,0.1)";
const CACHE_D=(d:string)=>`pc3_doses_${d}`,CACHE_P="pc3_profile",CACHE_S="pc3_streak";
function todayStr(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function getWeekDays(c:string){const b=new Date(c),dy=b.getDay(),mn=new Date(b);mn.setDate(b.getDate()-((dy+6)%7));return Array.from({length:7},(_,i)=>{const d=new Date(mn);d.setDate(mn.getDate()+i);return{lbl:["MON","TUE","WED","THU","FRI","SAT","SUN"][i],num:d.getDate(),iso:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};});}
function getSec(t:string){const[h]=t.split(":").map(Number);return h<12?"morning":h<17?"afternoon":h<21?"evening":"night";}
const SICO:any={morning:"sunny-outline",afternoon:"partly-sunny-outline",evening:"moon-outline",night:"moon-outline"};

export default function Today(){
  const[date,setDate]=useState(todayStr());
  const[doses,setDoses]=useState<any[]>([]);
  const[profile,setProfile]=useState<any>(null);
  const[aiMsg,setAiMsg]=useState<string|null>(null);
  const[streak,setStreak]=useState(0);
  const[sheet,setSheet]=useState(false);
  const[calOpen,setCalOpen]=useState(false);
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

  const taken=doses.filter(d=>d.status==="taken").length,total=doses.length;
  const next=doses.filter(d=>d.status==="pending").sort((a,b)=>a.scheduled_time.localeCompare(b.scheduled_time))[0];
  const secs:Record<string,any[]>={};
  for(const d of doses){const sc=getSec(d.scheduled_time);if(!secs[sc])secs[sc]=[];secs[sc].push(d);}

  return(
    <SafeAreaView style={s.safe}edges={["top"]}>
      {/* Header */}
      <View style={s.hdr}>
        <Text style={s.appNm}>PillCare</Text>
        <View style={s.hdrR}>
          <TouchableOpacity style={s.iconBtn}onPress={()=>setCalOpen(true)}>
            <Ionicons name="calendar-outline"size={15}color={TX}/>
          </TouchableOpacity>
          <View style={s.streakTag}>
            <Ionicons name="flame"size={13}color={A3}/>
            <Text style={s.streakTx}>{streak}</Text>
          </View>
          <TouchableOpacity style={s.iconBtn}>
            <Ionicons name="menu-outline"size={16}color={TX}/>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body}showsVerticalScrollIndicator={false}refreshControl={<RefreshControl refreshing={refreshing}onRefresh={onRefresh}tintColor={AC}/>}>

        {/* Overview card - design style */}
        <View style={s.ovCard}>
          <View style={s.ovTag}><Text style={s.ovTagTx}>{profile?.nickname?.toUpperCase()||"YOU"}</Text></View>
          <Text style={s.ovTitle}>Your consistency{"\n"}is your strength.</Text>
          <Text style={s.ovSub}>You have {total-taken} medications left for today.</Text>
          <View style={{gap:4,marginTop:8}}>
            {next&&(<View style={s.metaRow}><Ionicons name="time-outline"size={12}color={A3}/><Text style={s.metaTx}>Next Dose: <Text style={{color:TX}}>{next.medication?.name}</Text> at {next.scheduled_time}</Text></View>)}
            <View style={s.metaRow}><Ionicons name="flame"size={12}color={A3}/><Text style={s.metaTx}>Current Streak: <Text style={{color:TX,fontWeight:"700"}}>{streak} Days</Text></Text></View>
          </View>
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

        {/* AI Insight */}
        {aiMsg&&(
          <View style={s.aiCard}>
            <View style={s.aiHdr}><Ionicons name="sparkles"size={10}color={A3}/><Text style={s.aiK}>AI INSIGHT</Text></View>
            <Text style={s.aiTx}>{aiMsg}</Text>
          </View>
        )}

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
            <View key={sec}style={{gap:8,marginBottom:8}}>
              <View style={s.secHdr}>
                <Ionicons name={SICO[sec]}size={12}color={A3}/>
                <Text style={s.secLbl}>{sec.toUpperCase()} • {items[0]?.scheduled_time}</Text>
              </View>
              {items.map(dose=>{
                const m=dose.medication||{},st=dose.status||"pending";
                const tk=st==="taken",sk=st==="skipped"||st==="missed";
                return(
                  <View key={dose.id}style={[s.dc,tk&&s.dcDim]}>
                    <View style={s.dIco}><Ionicons name="medical-outline"size={16}color={tk?TM:A3}/></View>
                    <View style={{flex:1}}>
                      <Text style={[s.dNm,tk&&{color:TM}]}>{m.name||"Unknown"}</Text>
                      <Text style={s.dMeta}>{m.dosage?`${m.dosage} ${m.unit}`:m.unit||""}</Text>
                    </View>
                    <TouchableOpacity style={[s.dBtn,tk?s.bTk:sk?s.bSk:s.bPd]}onPress={()=>mark(dose.id,st)}>
                      <Text style={[s.dBtnTx,tk?{color:A3}:sk?{color:"#e58585"}:{color:"#fff"}]}>{tk?"Taken":sk?"Skipped":"Take"}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* AI Yoga card */}
        {aiMsg&&(
          <View style={[s.dc,{borderColor:"rgba(145,132,217,0.3)",gap:12}]}>
            <View style={[s.dIco,{borderRadius:18}]}><Ionicons name="body-outline"size={17}color={A3}/></View>
            <View style={{flex:1}}>
              <View style={s.aiHdr}><Ionicons name="sparkles"size={9}color={A3}/><Text style={[s.aiK,{fontSize:9}]}>AI RECOMMENDED YOGA</Text></View>
              <Text style={s.dNm}>Gentle Digestion Flow</Text>
              <Text style={s.dMeta}>Based on today's scheduled doses</Text>
            </View>
            <TouchableOpacity style={[s.dBtn,{backgroundColor:"rgba(233,233,237,0.08)"}]}><Text style={[s.dBtnTx,{color:TX}]}>View</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab}onPress={()=>setSheet(true)}>
        <Ionicons name="add"size={24}color={BG}/>
      </TouchableOpacity>

      {/* Calendar modal */}
      <Modal visible={calOpen}transparent animationType="fade"onRequestClose={()=>setCalOpen(false)}>
        <TouchableOpacity style={s.overlay}activeOpacity={1}onPress={()=>setCalOpen(false)}>
          <View style={s.calSheet}>
            <View style={s.sheetHandle}/>
            <Text style={s.sheetTitle}>July 2026</Text>
            <View style={s.calGrid}>
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>(<Text key={d}style={s.calDayHdr}>{d}</Text>))}
              {Array.from({length:31},(_,i)=>(<TouchableOpacity key={i}style={[s.calDay,i+1===parseInt(date.split("-")[2])&&s.calDayOn]}><Text style={[s.calDayTx,i+1===parseInt(date.split("-")[2])&&{color:"#fff"}]}>{i+1}</Text></TouchableOpacity>))}
            </View>
            <View style={s.dc}>
              <View style={[s.dIco,{borderRadius:19}]}><Ionicons name="flame"size={19}color={A3}/></View>
              <View><Text style={s.dNm}>{streak} day streak</Text><Text style={s.dMeta}>You're doing well! Keep it up.</Text></View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <AddMedicationSheet visible={sheet}onClose={()=>setSheet(false)}onSaved={()=>{setSheet(false);load();resyncReminders().catch(()=>{});}}/>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:BG},
  hdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingTop:10,paddingBottom:6},
  appNm:{fontSize:16,fontWeight:"600",color:TX,letterSpacing:-.2},
  hdrR:{flexDirection:"row",alignItems:"center",gap:7},
  iconBtn:{width:32,height:32,borderRadius:16,borderWidth:1,borderColor:"rgba(233,233,237,0.15)",alignItems:"center",justifyContent:"center"},
  streakTag:{flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:10,paddingVertical:4,borderRadius:999,backgroundColor:AB,borderWidth:1,borderColor:"rgba(145,132,217,0.25)"},
  streakTx:{fontSize:13,fontWeight:"600",color:A3},
  body:{paddingHorizontal:16,paddingBottom:110,gap:12},
  ovCard:{backgroundColor:SF,borderRadius:18,padding:16,gap:6,borderWidth:1,borderColor:BORDER},
  ovTag:{alignSelf:"flex-start",paddingHorizontal:8,paddingVertical:3,borderRadius:999,backgroundColor:AB,marginBottom:4},
  ovTagTx:{fontSize:9,fontWeight:"700",color:A3,letterSpacing:1},
  ovTitle:{fontSize:20,fontWeight:"700",color:TX,lineHeight:26,letterSpacing:-.4},
  ovSub:{fontSize:12,color:TM,lineHeight:17},
  metaRow:{flexDirection:"row",alignItems:"center",gap:5},
  metaTx:{fontSize:11,color:TM},
  strip:{paddingVertical:4,gap:6},
  pill:{width:46,height:60,borderRadius:14,alignItems:"center",justifyContent:"center",gap:2,borderWidth:1,borderColor:BORDER},
  pillOn:{backgroundColor:AB,borderColor:AC},
  pLbl:{fontSize:9,letterSpacing:.6,textTransform:"uppercase",color:TD,fontWeight:"700"},
  pLblOn:{color:A3},
  pNum:{fontSize:17,fontWeight:"700",color:TX},
  pNumOn:{color:A3},
  aiCard:{backgroundColor:"rgba(145,132,217,0.07)",borderRadius:14,padding:13,gap:5,borderWidth:1,borderColor:"rgba(145,132,217,0.22)"},
  aiHdr:{flexDirection:"row",alignItems:"center",gap:4},
  aiK:{fontSize:9,letterSpacing:1,textTransform:"uppercase",color:A3,fontWeight:"700"},
  aiTx:{fontSize:12,color:TM,lineHeight:17},
  secHdr:{flexDirection:"row",alignItems:"center",gap:5},
  secLbl:{fontSize:10,letterSpacing:.7,color:TM,fontWeight:"600"},
  dc:{backgroundColor:SF,borderRadius:14,padding:12,flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:BORDER},
  dcDim:{backgroundColor:"rgba(35,37,50,0.5)",borderColor:"rgba(233,233,237,0.06)"},
  dIco:{width:34,height:34,borderRadius:10,backgroundColor:AB,alignItems:"center",justifyContent:"center"},
  dNm:{fontSize:13,fontWeight:"600",color:TX},
  dMeta:{fontSize:10,color:TM,marginTop:1},
  dBtn:{height:30,paddingHorizontal:12,borderRadius:8,alignItems:"center",justifyContent:"center"},
  bPd:{backgroundColor:AC},bTk:{backgroundColor:"rgba(145,132,217,0.12)",borderWidth:1,borderColor:"rgba(145,132,217,0.2)"},bSk:{backgroundColor:"rgba(229,133,133,0.12)"},
  dBtnTx:{fontSize:11,fontWeight:"700"},
  empty:{backgroundColor:SF,borderRadius:18,padding:36,alignItems:"center",gap:8,borderWidth:1,borderColor:BORDER},
  emIco:{width:52,height:52,borderRadius:26,backgroundColor:AB,alignItems:"center",justifyContent:"center",marginBottom:4},
  emTitle:{fontSize:15,fontWeight:"700",color:TX},emSub:{fontSize:12,color:TM,textAlign:"center"},
  fab:{position:"absolute",right:18,bottom:90,width:52,height:52,borderRadius:26,backgroundColor:AC,alignItems:"center",justifyContent:"center",elevation:6},
  overlay:{flex:1,backgroundColor:"rgba(0,0,0,0.55)",justifyContent:"flex-end"},
  calSheet:{backgroundColor:N800,borderTopLeftRadius:20,borderTopRightRadius:20,padding:18,gap:12},
  sheetHandle:{width:36,height:4,borderRadius:2,backgroundColor:"rgba(233,233,237,0.25)",alignSelf:"center",marginBottom:4},
  sheetTitle:{fontSize:15,fontWeight:"700",color:TX,textAlign:"center"},
  calGrid:{flexDirection:"row",flexWrap:"wrap",gap:4},
  calDayHdr:{width:"14.28%",textAlign:"center",fontSize:9,color:TM,fontWeight:"600",paddingBottom:4},
  calDay:{width:"14.28%",aspectRatio:1,borderRadius:999,alignItems:"center",justifyContent:"center"},
  calDayOn:{backgroundColor:AC},
  calDayTx:{fontSize:12,color:TX},
});
"""