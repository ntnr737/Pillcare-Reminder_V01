import{useCallback,useState}from"react";
import{View,Text,StyleSheet,ScrollView,TouchableOpacity,RefreshControl}from"react-native";
import{SafeAreaView}from"react-native-safe-area-context";
import{Ionicons}from"@expo/vector-icons";
import{useFocusEffect}from"expo-router";
import{api}from"@/src/lib/api";

const BG="#161826",SF="#232532",TX="#e9e9ed",TM="rgba(233,233,237,0.55)",AC="#9184d9",A3="#a7a1db",AB="rgba(145,132,217,0.14)",BORDER="rgba(233,233,237,0.1)";
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
        <TouchableOpacity style={s.iconBtn}><Ionicons name="share-outline"size={15}color={TX}/></TouchableOpacity>
      </View>

      {/* Segmented control exactly like design */}
      <View style={s.seg}>
        <TouchableOpacity style={[s.segOpt,tab==="charts"&&s.segOn]}onPress={()=>setTab("charts")}><Text style={[s.segTx,tab==="charts"&&s.segTxOn]}>Charts</Text></TouchableOpacity>
        <TouchableOpacity style={[s.segOpt,tab==="list"&&s.segOn]}onPress={()=>setTab("list")}><Text style={[s.segTx,tab==="list"&&s.segTxOn]}>List</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body}showsVerticalScrollIndicator={false}refreshControl={<RefreshControl refreshing={refreshing}onRefresh={onRefresh}tintColor={AC}/>}>

        {tab==="charts"&&(<>
          {/* Weekly adherence card */}
          <View style={s.card}>
            <View style={s.cardHdr}>
              <View><Text style={s.cardTitle}>Weekly Adherence</Text><Text style={s.cardSub}>Last 7 days</Text></View>
              <View style={{alignItems:"flex-end"}}>
                <Text style={[s.bigNum,{color:avg>=80?A3:avg>=50?"#e5b285":"#e58585"}]}>{avg}%</Text>
                <Text style={s.bigSub}>{avg>=80?"on track":avg>=50?"improving":"needs work"}</Text>
              </View>
            </View>
            <View style={s.barChart}>
              {daily.length>0?daily.map((d:any,i:number)=>{
                const h=Math.max((d.pct/maxPct)*64,4);
                const isToday=i===daily.length-1;
                return(<View key={i}style={s.barCol}><View style={{flex:1,justifyContent:"flex-end"}}><View style={[s.bar,{height:h,backgroundColor:isToday?AC:d.pct>=80?"rgba(145,132,217,0.4)":"rgba(233,233,237,0.15)"}]}/></View><Text style={s.barLbl}>{DAY_LABELS[i]}</Text></View>);
              }):DAY_LABELS.map((l,i)=>(<View key={i}style={s.barCol}><View style={{flex:1,justifyContent:"flex-end"}}><View style={[s.bar,{height:16,backgroundColor:"rgba(233,233,237,0.1)"}]}/></View><Text style={s.barLbl}>{l}</Text></View>))}
            </View>
          </View>

          {/* Stats 2-col grid exactly like design */}
          <View style={s.grid}>
            <View style={[s.card,{flex:1,gap:4}]}>
              <Ionicons name="flame"size={16}color={A3}/>
              <Text style={s.statNum}>{streak} <Text style={{fontSize:12,fontWeight:"400",color:TM}}>days</Text></Text>
              <Text style={s.statLbl}>Current streak</Text>
            </View>
            <View style={[s.card,{flex:1,gap:4}]}>
              <Ionicons name="checkmark-circle"size={16}color={A3}/>
              <Text style={s.statNum}>{totalTaken}</Text>
              <Text style={s.statLbl}>Doses taken (7d)</Text>
            </View>
          </View>

          {/* Connected devices placeholder - from design */}
          <Text style={s.secLbl}>CONNECTED DEVICES</Text>
          <View style={s.card}>
            <View style={s.cardRow}>
              <View style={s.cardIco}><Ionicons name="heart-outline"size={16}color={A3}/></View>
              <View style={{flex:1}}><Text style={s.cardTitle}>Health Connect</Text><Text style={s.cardSub}>Tap to connect Android health data</Text></View>
              <TouchableOpacity style={s.connectBtn}><Text style={s.connectTx}>Connect</Text></TouchableOpacity>
            </View>
          </View>

          {/* AI Recommendation - from design */}
          {adh&&(<View style={[s.card,{flexDirection:"row",gap:12,borderColor:"rgba(145,132,217,0.3)"}]}>
            <View style={[s.cardIco,{borderRadius:18}]}><Ionicons name="sparkles"size={17}color={A3}/></View>
            <View style={{flex:1}}>
              <View style={{flexDirection:"row",alignItems:"center",gap:4,marginBottom:2}}><Ionicons name="sparkles"size={10}color={A3}/><Text style={{fontSize:9,letterSpacing:1,color:A3,fontWeight:"700"}}>AI RECOMMENDATION</Text></View>
              <Text style={s.cardTitle}>Review your evening doses</Text>
              <Text style={s.cardSub}>Adherence dips after 9 PM based on your history</Text>
            </View>
          </View>)}

          {/* Mood */}
          {mood.length>0&&(<View style={s.card}>
            <Text style={s.cardTitle}>Mood This Week</Text>
            <View style={s.moodRow}>{mood.slice(0,7).map((m:any,i:number)=>(<View key={i}style={s.moodItem}><Text style={{fontSize:20}}>{moodEmoji(m.score)}</Text><Text style={s.moodScore}>{m.score}</Text></View>))}</View>
          </View>)}
        </>)}

        {tab==="list"&&(<>
          {measurements.length>0?(<View style={s.card}>
            <Text style={s.cardTitle}>Measurements</Text>
            {measurements.map((m:any,i:number)=>(<View key={i}style={[s.cardRow,{paddingVertical:8},i<measurements.length-1&&{borderBottomWidth:1,borderBottomColor:BORDER}]}>
              <View style={s.cardIco}><Ionicons name="pulse-outline"size={13}color={A3}/></View>
              <View style={{flex:1}}><Text style={s.cardTitle}>{m.type?.replace(/_/g," ")}</Text><Text style={s.cardSub}>{new Date(m.recorded_at).toLocaleDateString()}</Text></View>
              <Text style={{fontSize:15,fontWeight:"700",color:A3}}>{m.value}{m.value_secondary?`/${m.value_secondary}`:""}<Text style={{fontSize:10,color:TM}}> {m.unit}</Text></Text>
            </View>))}
          </View>):(
            <View style={[s.card,{alignItems:"center",padding:32,gap:8}]}><Ionicons name="bar-chart-outline"size={28}color={AC}/><Text style={s.cardTitle}>No data yet</Text><Text style={s.cardSub}>Start logging medications to see progress</Text></View>
          )}
        </>)}
      </ScrollView>
    </SafeAreaView>
  );
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:BG},hdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingTop:10,paddingBottom:4},title:{fontSize:20,fontWeight:"700",color:TX,letterSpacing:-.4},iconBtn:{width:32,height:32,borderRadius:16,borderWidth:1,borderColor:BORDER,alignItems:"center",justifyContent:"center"},seg:{flexDirection:"row",marginHorizontal:16,marginBottom:8,backgroundColor:SF,borderRadius:10,padding:3,borderWidth:1,borderColor:BORDER},segOpt:{flex:1,height:30,borderRadius:8,alignItems:"center",justifyContent:"center"},segOn:{backgroundColor:"rgba(145,132,217,0.2)"},segTx:{fontSize:12,color:TM,fontWeight:"600"},segTxOn:{color:A3},body:{padding:16,paddingBottom:110,gap:12},card:{backgroundColor:SF,borderRadius:16,padding:14,gap:10,borderWidth:1,borderColor:BORDER},cardHdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start"},cardRow:{flexDirection:"row",alignItems:"center",gap:10},cardIco:{width:34,height:34,borderRadius:10,backgroundColor:AB,alignItems:"center",justifyContent:"center"},cardTitle:{fontSize:13,fontWeight:"600",color:TX},cardSub:{fontSize:10,color:TM,marginTop:2},bigNum:{fontSize:22,fontWeight:"700",letterSpacing:-.5},bigSub:{fontSize:9,color:TM},barChart:{flexDirection:"row",height:80,gap:5},barCol:{flex:1,alignItems:"center",gap:4,height:"100%"},bar:{width:"100%",borderRadius:4,minHeight:3},barLbl:{fontSize:8,color:TM,fontWeight:"600"},grid:{flexDirection:"row",gap:10},statNum:{fontSize:20,fontWeight:"700",color:TX},statLbl:{fontSize:10,color:TM},secLbl:{fontSize:10,letterSpacing:1,color:TM,fontWeight:"700",marginTop:4},connectBtn:{paddingHorizontal:10,height:28,borderRadius:8,backgroundColor:AB,borderWidth:1,borderColor:"rgba(145,132,217,0.25)",alignItems:"center",justifyContent:"center"},connectTx:{fontSize:10,color:A3,fontWeight:"700"},moodRow:{flexDirection:"row",justifyContent:"space-around",paddingTop:4},moodItem:{alignItems:"center",gap:3},moodScore:{fontSize:10,fontWeight:"700",color:TM}});
