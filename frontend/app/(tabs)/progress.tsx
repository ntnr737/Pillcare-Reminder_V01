import{useCallback,useState}from"react";
import{View,Text,StyleSheet,ScrollView,TouchableOpacity,RefreshControl}from"react-native";
import{SafeAreaView}from"react-native-safe-area-context";
import{Ionicons}from"@expo/vector-icons";
import{useFocusEffect}from"expo-router";
import{api}from"@/src/lib/api";

const BG="#161826",SF="#232532",TX="#e9e9ed",TM="rgba(233,233,237,0.55)",AC="#9184d9",AL="#a7a1db",AB="rgba(145,132,217,0.14)",BORDER="rgba(233,233,237,0.1)";
const DAY_LABELS=["M","T","W","T","F","S","S"];

export default function Progress(){
  const[adh,setAdh]=useState<any>(null);
  const[measurements,setMeasurements]=useState<any[]>([]);
  const[mood,setMood]=useState<any[]>([]);
  const[tab,setTab]=useState<"charts"|"list">("charts");
  const[refreshing,setRefreshing]=useState(false);

  const load=useCallback(async()=>{try{const[a,ms,mo]=await Promise.all([api.adherence(7),api.listMeasurements(),api.listMood()]);setAdh(a);setMeasurements((ms||[]).slice(0,8));setMood((mo||[]).slice(0,7));}catch{}},[]);
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
        <TouchableOpacity style={s.iconBtn}><Ionicons name="share-outline"size={16}color={TX}/></TouchableOpacity>
      </View>

      {/* Charts / List toggle */}
      <View style={s.seg}>
        <TouchableOpacity style={[s.segOpt,tab==="charts"&&s.segOptOn]}onPress={()=>setTab("charts")}><Text style={[s.segTx,tab==="charts"&&s.segTxOn]}>Charts</Text></TouchableOpacity>
        <TouchableOpacity style={[s.segOpt,tab==="list"&&s.segOptOn]}onPress={()=>setTab("list")}><Text style={[s.segTx,tab==="list"&&s.segTxOn]}>List</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body}showsVerticalScrollIndicator={false}refreshControl={<RefreshControl refreshing={refreshing}onRefresh={onRefresh}tintColor={AC}/>}>

        {tab==="charts"&&(<>
          {/* Weekly Adherence Card */}
          <View style={s.card}>
            <View style={s.cardHdr}>
              <View><Text style={s.cardTitle}>Weekly Adherence</Text><Text style={s.cardSub}>Last 7 days</Text></View>
              <View style={{alignItems:"flex-end"}}>
                <Text style={[s.bigNum,{color:avg>=80?AL:avg>=50?"#e5b285":"#e58585"}]}>{avg}%</Text>
                <Text style={s.bigSub}>{avg>=80?"on track":avg>=50?"improving":"needs work"}</Text>
              </View>
            </View>
            <View style={s.barChart}>
              {daily.length>0?daily.map((d:any,i:number)=>{
                const h=Math.max((d.pct/maxPct)*64,4);
                const isToday=i===daily.length-1;
                return(<View key={i}style={s.barCol}><View style={{flex:1,justifyContent:"flex-end"}}><View style={[s.bar,{height:h,backgroundColor:isToday?AC:d.pct>=80?"rgba(145,132,217,0.4)":"rgba(233,233,237,0.14)"}]}/></View><Text style={s.barLbl}>{DAY_LABELS[i]}</Text></View>);
              }):DAY_LABELS.map((l,i)=>(<View key={i}style={s.barCol}><View style={{flex:1,justifyContent:"flex-end"}}><View style={[s.bar,{height:16,backgroundColor:"rgba(233,233,237,0.1)"}]}/></View><Text style={s.barLbl}>{l}</Text></View>))}
            </View>
          </View>

          {/* Stat cards */}
          <View style={s.grid}>
            <View style={[s.card,{flex:1,alignItems:"flex-start",gap:5}]}>
              <Ionicons name="flame"size={16}color={AL}/>
              <Text style={s.statNum}>{streak} <Text style={{fontSize:12,fontWeight:"400",color:TM}}>days</Text></Text>
              <Text style={s.statLbl}>Current streak</Text>
            </View>
            <View style={[s.card,{flex:1,alignItems:"flex-start",gap:5}]}>
              <Ionicons name="checkmark-circle"size={16}color={AL}/>
              <Text style={s.statNum}>{totalTaken}</Text>
              <Text style={s.statLbl}>Doses taken (7d)</Text>
            </View>
          </View>

          {/* Mood */}
          {mood.length>0&&(
            <View style={s.card}>
              <Text style={s.cardTitle}>Mood this week</Text>
              <View style={s.moodRow}>
                {mood.slice(0,7).map((m:any,i:number)=>(<View key={i}style={s.moodItem}><Text style={{fontSize:20}}>{moodEmoji(m.score)}</Text><Text style={s.moodScore}>{m.score}</Text></View>))}
              </View>
            </View>
          )}
        </>)}

        {tab==="list"&&(<>
          {/* Measurements list */}
          {measurements.length>0&&(
            <View style={s.card}>
              <Text style={s.cardTitle}>Measurements</Text>
              {measurements.map((m:any,i:number)=>(
                <View key={i}style={[s.mRow,i<measurements.length-1&&s.div]}>
                  <View style={s.mIco}><Ionicons name="pulse-outline"size={13}color={AL}/></View>
                  <View style={{flex:1}}><Text style={s.mName}>{m.type?.replace(/_/g," ")}</Text><Text style={s.mDate}>{new Date(m.recorded_at).toLocaleDateString()}</Text></View>
                  <Text style={s.mVal}>{m.value}{m.value_secondary?`/${m.value_secondary}`:""}<Text style={{fontSize:10,color:TM}}> {m.unit}</Text></Text>
                </View>
              ))}
            </View>
          )}
          {measurements.length===0&&(<View style={[s.card,{alignItems:"center",padding:28,gap:8}]}><Ionicons name="bar-chart-outline"size={28}color={AC}/><Text style={{fontSize:14,fontWeight:"700",color:TX}}>No data yet</Text><Text style={{fontSize:12,color:TM,textAlign:"center"}}>Log medications to see progress</Text></View>)}
        </>)}
      </ScrollView>
    </SafeAreaView>
  );
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:BG},hdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:18,paddingTop:12,paddingBottom:4},title:{fontSize:20,fontWeight:"700",color:TX,letterSpacing:-.4},iconBtn:{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:BORDER,alignItems:"center",justifyContent:"center"},seg:{flexDirection:"row",marginHorizontal:18,marginVertical:8,backgroundColor:SF,borderRadius:10,padding:3,borderWidth:1,borderColor:BORDER},segOpt:{flex:1,height:30,borderRadius:8,alignItems:"center",justifyContent:"center"},segOptOn:{backgroundColor:"rgba(145,132,217,0.2)"},segTx:{fontSize:12,color:TM,fontWeight:"600"},segTxOn:{color:AL},body:{padding:18,paddingBottom:110,gap:12},card:{backgroundColor:SF,borderRadius:16,padding:14,gap:10,borderWidth:1,borderColor:BORDER},cardHdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start"},cardTitle:{fontSize:13,fontWeight:"600",color:TX},cardSub:{fontSize:10,color:TM,marginTop:2},bigNum:{fontSize:22,fontWeight:"700",letterSpacing:-.5},bigSub:{fontSize:9,color:TM},barChart:{flexDirection:"row",height:80,gap:5},barCol:{flex:1,alignItems:"center",gap:4,height:"100%"},bar:{width:"100%",borderRadius:4,minHeight:3},barLbl:{fontSize:8,color:TM,fontWeight:"600"},grid:{flexDirection:"row",gap:10},statNum:{fontSize:20,fontWeight:"700",color:TX},statLbl:{fontSize:10,color:TM},moodRow:{flexDirection:"row",justifyContent:"space-around",paddingTop:4},moodItem:{alignItems:"center",gap:3},moodScore:{fontSize:10,fontWeight:"700",color:TM},mRow:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:8},div:{borderBottomWidth:1,borderBottomColor:BORDER},mIco:{width:30,height:30,borderRadius:15,backgroundColor:AB,alignItems:"center",justifyContent:"center"},mName:{fontSize:12,fontWeight:"600",color:TX,textTransform:"capitalize"},mDate:{fontSize:9,color:TM,marginTop:1},mVal:{fontSize:15,fontWeight:"700",color:AL}});
