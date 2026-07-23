import{useCallback,useState}from"react";
import{View,Text,StyleSheet,ScrollView,TouchableOpacity,RefreshControl}from"react-native";
import{SafeAreaView}from"react-native-safe-area-context";
import{Ionicons}from"@expo/vector-icons";
import{useFocusEffect}from"expo-router";
import{api}from"@/src/lib/api";
const BG="#161826",SF="#232532",TX="#e9e9ed",TM="rgba(233,233,237,0.5)",AC="#9184d9",AL="#a7a1db",AB="rgba(145,132,217,0.16)";
const DAY_LABELS=["M","T","W","T","F","S","S"];
export default function Progress(){
  const[adh,setAdh]=useState<any>(null);
  const[measurements,setMeasurements]=useState<any[]>([]);
  const[mood,setMood]=useState<any[]>([]);
  const[refreshing,setRefreshing]=useState(false);
  const load=useCallback(async()=>{try{const[a,ms,mo]=await Promise.all([api.adherence(7),api.listMeasurements(),api.listMood()]);setAdh(a);setMeasurements((ms||[]).slice(0,5));setMood((mo||[]).slice(0,7));}catch{}},[]);
  useFocusEffect(useCallback(()=>{load();},[load]));
  const onRefresh=async()=>{setRefreshing(true);await load();setRefreshing(false);};
  const daily=adh?.daily||[];
  const avg=adh?.average||0;
  const streak=adh?.streak||0;
  const maxPct=Math.max(...daily.map((d:any)=>d.pct||0),1);
  const totalTaken=daily.reduce((s:number,d:any)=>s+(d.taken||0),0);
  const moodAvg=mood.length>0?Math.round(mood.reduce((s:any,m:any)=>s+m.score,0)/mood.length*10)/10:0;
  const moodEmoji=(sc:number)=>sc>=4?"\U0001F60A":sc>=3?"\U0001F610":sc>=2?"\U0001F614":"\U0001F61F";
  return(
    <SafeAreaView style={s.safe}edges={["top"]}>
      <View style={s.hdr}>
        <Text style={s.title}>Progress</Text>
        <TouchableOpacity style={s.exportBtn}><Ionicons name="share-outline"size={16}color={TX}/></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.body}showsVerticalScrollIndicator={false}refreshControl={<RefreshControl refreshing={refreshing}onRefresh={onRefresh}tintColor={AC}/>}>
        <View style={s.card}>
          <View style={s.cardHdr}>
            <View><Text style={s.cardTitle}>Weekly Adherence</Text><Text style={s.cardSub}>Last 7 days</Text></View>
            <View style={{alignItems:"flex-end"}}><Text style={s.bigNum}>{avg}%</Text><Text style={s.bigSub}>on track</Text></View>
          </View>
          <View style={s.barChart}>
            {daily.length>0?daily.map((d:any,i:number)=>{const h=maxPct>0?Math.max((d.pct/maxPct)*64,4):4;const active=d.pct>0&&d.pct===maxPct;return(<View key={i}style={s.barCol}><View style={[s.bar,{height:h,backgroundColor:active?AC:"rgba(233,233,237,0.18)"}]}/><Text style={s.barLbl}>{DAY_LABELS[i]}</Text></View>);}):DAY_LABELS.map((l,i)=>(<View key={i}style={s.barCol}><View style={[s.bar,{height:20,backgroundColor:"rgba(233,233,237,0.12)"}]}/><Text style={s.barLbl}>{l}</Text></View>))}
          </View>
        </View>
        <View style={s.grid}>
          <View style={[s.card,{flex:1}]}><Ionicons name="flame"size={16}color={AL}/><Text style={s.statNum}>{streak}</Text><Text style={s.statLbl}>Day streak</Text></View>
          <View style={[s.card,{flex:1}]}><Ionicons name="checkmark-circle"size={16}color={AL}/><Text style={s.statNum}>{totalTaken}</Text><Text style={s.statLbl}>Doses taken (7d)</Text></View>
          <View style={[s.card,{flex:1}]}><Text style={{fontSize:16}}>{moodEmoji(moodAvg)}</Text><Text style={s.statNum}>{mood.length>0?moodAvg:"\u2013"}</Text><Text style={s.statLbl}>Avg mood</Text></View>
        </View>
        {measurements.length>0&&(<View style={s.card}><Text style={s.secTitle}>Recent Measurements</Text>{measurements.map((m:any,i:number)=>(<View key={i}style={[s.mRow,i<measurements.length-1&&s.div]}><View style={s.mIco}><Ionicons name="pulse-outline"size={14}color={AL}/></View><View style={{flex:1}}><Text style={s.mName}>{m.type?.replace(/_/g," ")}</Text><Text style={s.mDate}>{new Date(m.recorded_at).toLocaleDateString()}</Text></View><Text style={s.mVal}>{m.value}{m.value_secondary?`/${m.value_secondary}`:""} <Text style={{color:TM,fontSize:10}}>{m.unit}</Text></Text></View>))}</View>)}
        {mood.length>0&&(<View style={s.card}><Text style={s.secTitle}>Mood this week</Text><View style={s.moodRow}>{mood.slice(0,7).map((m:any,i:number)=>(<View key={i}style={s.moodItem}><Text style={{fontSize:20}}>{moodEmoji(m.score)}</Text><Text style={s.moodScore}>{m.score}</Text></View>))}</View></View>)}
        {measurements.length===0&&mood.length===0&&!adh&&(<View style={s.empty}><Ionicons name="bar-chart-outline"size={32}color={AC}/><Text style={s.emTitle}>No data yet</Text><Text style={s.emSub}>Start logging medications to see your progress</Text></View>)}
      </ScrollView>
    </SafeAreaView>
  );
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:BG},hdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingTop:10,paddingBottom:8},title:{fontSize:20,fontWeight:"700",color:TX,letterSpacing:-0.4},exportBtn:{width:32,height:32,borderRadius:16,borderWidth:1,borderColor:"rgba(233,233,237,0.15)",alignItems:"center",justifyContent:"center"},body:{padding:16,paddingBottom:100,gap:12},card:{backgroundColor:SF,borderRadius:16,padding:14,gap:10},cardHdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start"},cardTitle:{fontSize:14,fontWeight:"600",color:TX},cardSub:{fontSize:11,color:TM,marginTop:2},bigNum:{fontSize:22,fontWeight:"700",color:AL,letterSpacing:-0.4},bigSub:{fontSize:10,color:TM,textAlign:"right"},barChart:{flexDirection:"row",alignItems:"flex-end",height:80,gap:6},barCol:{flex:1,alignItems:"center",gap:5,height:"100%",justifyContent:"flex-end"},bar:{width:"100%",borderRadius:4,minHeight:4},barLbl:{fontSize:9,color:TM},grid:{flexDirection:"row",gap:10},statNum:{fontSize:20,fontWeight:"700",color:TX,letterSpacing:-0.4,marginTop:2},statLbl:{fontSize:10,color:TM,lineHeight:14},secTitle:{fontSize:13,fontWeight:"700",color:TX,marginBottom:4},mRow:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:8},div:{borderBottomWidth:1,borderBottomColor:"rgba(233,233,237,0.08)"},mIco:{width:30,height:30,borderRadius:15,backgroundColor:AB,alignItems:"center",justifyContent:"center"},mName:{fontSize:13,fontWeight:"600",color:TX,textTransform:"capitalize"},mDate:{fontSize:10,color:TM,marginTop:1},mVal:{fontSize:15,fontWeight:"700",color:AL},moodRow:{flexDirection:"row",justifyContent:"space-around"},moodItem:{alignItems:"center",gap:4},moodScore:{fontSize:12,fontWeight:"700",color:TM},empty:{backgroundColor:SF,borderRadius:18,padding:32,alignItems:"center",gap:8},emTitle:{fontSize:16,fontWeight:"700",color:TX},emSub:{fontSize:13,color:TM,textAlign:"center"}});
