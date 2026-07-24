import{useCallback,useState}from"react";
import{View,Text,StyleSheet,ScrollView,TouchableOpacity,RefreshControl}from"react-native";
import{SafeAreaView}from"react-native-safe-area-context";
import{Ionicons}from"@expo/vector-icons";
import{useFocusEffect}from"expo-router";
import{api}from"@/src/lib/api";

const BG="#161826",SF="#232532",TX="#e9e9ed",TM="rgba(233,233,237,0.5)",TD="rgba(233,233,237,0.3)",AC="#9184d9",AL="#a7a1db",AB="rgba(145,132,217,0.16)",BORDER="rgba(233,233,237,0.12)";
const DAY_LABELS=["M","T","W","T","F","S","S"];

export default function Progress(){
  const[adh,setAdh]=useState<any>(null);
  const[measurements,setMeasurements]=useState<any[]>([]);
  const[mood,setMood]=useState<any[]>([]);
  const[refreshing,setRefreshing]=useState(false);

  const load=useCallback(async()=>{
    try{
      const[a,ms,mo]=await Promise.all([api.adherence(7),api.listMeasurements(),api.listMood()]);
      setAdh(a);setMeasurements((ms||[]).slice(0,5));setMood((mo||[]).slice(0,7));
    }catch{}
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));
  const onRefresh=async()=>{setRefreshing(true);await load();setRefreshing(false);};

  const daily=adh?.daily||[];
  const avg=adh?.average||0;
  const streak=adh?.streak||0;
  const maxPct=Math.max(...daily.map((d:any)=>d.pct||0),1);
  const totalTaken=daily.reduce((s:number,d:any)=>s+(d.taken||0),0);
  const moodAvg=mood.length>0?Math.round(mood.reduce((s:any,m:any)=>s+m.score,0)/mood.length*10)/10:0;
  const moodEmoji=(sc:number)=>sc>=4?"\U0001F60A":sc>=3?"\U0001F610":sc>=2?"\U0001F614":"\U0001F61F";

  const adherenceColor=(pct:number)=>pct>=80?AC:pct>=50?"#e5b285":"#e58585";

  return(
    <SafeAreaView style={s.safe}edges={["top"]}>
      <View style={s.hdr}>
        <View>
          <Text style={s.title}>Progress</Text>
          <Text style={s.sub}>Your wellness at a glance</Text>
        </View>
        <TouchableOpacity style={s.exportBtn}>
          <Ionicons name="share-outline"size={15}color={TX}/>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body}showsVerticalScrollIndicator={false}refreshControl={<RefreshControl refreshing={refreshing}onRefresh={onRefresh}tintColor={AC}/>}>

        {/* Weekly Adherence */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <View>
              <Text style={s.cardTitle}>Weekly Adherence</Text>
              <Text style={s.cardSub}>Last 7 days</Text>
            </View>
            <View style={{alignItems:"flex-end"}}>
              <Text style={[s.bigNum,{color:adherenceColor(avg)}]}>{avg}%</Text>
              <Text style={s.bigSub}>{avg>=80?"On track":avg>=50?"Improving":"Needs work"}</Text>
            </View>
          </View>
          <View style={s.barChart}>
            {daily.length>0?daily.map((d:any,i:number)=>{
              const h=Math.max((d.pct/maxPct)*72,4);
              const isToday=i===daily.length-1;
              return(
                <View key={i}style={s.barCol}>
                  <View style={{flex:1,justifyContent:"flex-end"}}>
                    <View style={[s.bar,{height:h,backgroundColor:isToday?AC:d.pct>=80?"rgba(145,132,217,0.4)":"rgba(233,233,237,0.15)"}]}/>
                  </View>
                  <Text style={s.barLbl}>{DAY_LABELS[i]}</Text>
                </View>
              );
            }):DAY_LABELS.map((l,i)=>(<View key={i}style={s.barCol}><View style={{flex:1,justifyContent:"flex-end"}}><View style={[s.bar,{height:20,backgroundColor:"rgba(233,233,237,0.1)"}]}/></View><Text style={s.barLbl}>{l}</Text></View>))}
          </View>
        </View>

        {/* Stats row */}
        <View style={s.grid}>
          <View style={[s.card,{flex:1,alignItems:"center",gap:4}]}>
            <Text style={{fontSize:20}}>\U0001F525</Text>
            <Text style={s.statNum}>{streak}</Text>
            <Text style={s.statLbl}>Day Streak</Text>
          </View>
          <View style={[s.card,{flex:1,alignItems:"center",gap:4}]}>
            <Ionicons name="checkmark-circle"size={20}color={AL}/>
            <Text style={s.statNum}>{totalTaken}</Text>
            <Text style={s.statLbl}>Doses Taken</Text>
          </View>
          <View style={[s.card,{flex:1,alignItems:"center",gap:4}]}>
            <Text style={{fontSize:20}}>{moodEmoji(moodAvg)}</Text>
            <Text style={s.statNum}>{mood.length>0?moodAvg:"\u2013"}</Text>
            <Text style={s.statLbl}>Avg Mood</Text>
          </View>
        </View>

        {/* Measurements */}
        {measurements.length>0&&(
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Text style={s.cardTitle}>Recent Measurements</Text>
              <Ionicons name="pulse-outline"size={14}color={AL}/>
            </View>
            {measurements.map((m:any,i:number)=>(
              <View key={i}style={[s.mRow,i<measurements.length-1&&s.div]}>
                <View style={s.mIco}><Ionicons name="pulse-outline"size={13}color={AL}/></View>
                <View style={{flex:1}}>
                  <Text style={s.mName}>{m.type?.replace(/_/g," ")}</Text>
                  <Text style={s.mDate}>{new Date(m.recorded_at).toLocaleDateString()}</Text>
                </View>
                <Text style={s.mVal}>{m.value}{m.value_secondary?`/${m.value_secondary}`:""}<Text style={{fontSize:10,color:TM}}> {m.unit}</Text></Text>
              </View>
            ))}
          </View>
        )}

        {/* Mood */}
        {mood.length>0&&(
          <View style={s.card}>
            <Text style={s.cardTitle}>Mood This Week</Text>
            <View style={s.moodRow}>
              {mood.slice(0,7).map((m:any,i:number)=>(
                <View key={i}style={s.moodItem}>
                  <Text style={{fontSize:22}}>{moodEmoji(m.score)}</Text>
                  <Text style={s.moodScore}>{m.score}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!adh&&measurements.length===0&&mood.length===0&&(
          <View style={[s.card,{alignItems:"center",padding:36,gap:10}]}>
            <View style={[s.mIco,{width:56,height:56,borderRadius:28}]}><Ionicons name="bar-chart-outline"size={28}color={AC}/></View>
            <Text style={{fontSize:16,fontWeight:"700",color:TX}}>No data yet</Text>
            <Text style={{fontSize:13,color:TM,textAlign:"center"}}>Start logging medications to see your progress</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:BG},
  hdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:18,paddingTop:10,paddingBottom:6},
  title:{fontSize:23,fontWeight:"700",color:TX,letterSpacing:-0.5},
  sub:{fontSize:12,color:TM,marginTop:2},
  exportBtn:{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:BORDER,alignItems:"center",justifyContent:"center"},
  body:{padding:18,paddingBottom:110,gap:12},
  card:{backgroundColor:SF,borderRadius:18,padding:16,gap:10,borderWidth:1,borderColor:BORDER},
  cardHdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start"},
  cardTitle:{fontSize:14,fontWeight:"600",color:TX},
  cardSub:{fontSize:11,color:TM,marginTop:2},
  bigNum:{fontSize:24,fontWeight:"700",letterSpacing:-0.5},
  bigSub:{fontSize:10,color:TM},
  barChart:{flexDirection:"row",height:96,gap:5,alignItems:"flex-end"},
  barCol:{flex:1,alignItems:"center",gap:5,height:"100%",justifyContent:"flex-end"},
  bar:{width:"100%",borderRadius:5,minHeight:4},
  barLbl:{fontSize:9,color:TM,fontWeight:"600"},
  grid:{flexDirection:"row",gap:10},
  statNum:{fontSize:21,fontWeight:"700",color:TX,letterSpacing:-0.5},
  statLbl:{fontSize:10,color:TM,textAlign:"center"},
  mRow:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:8},
  div:{borderBottomWidth:1,borderBottomColor:BORDER},
  mIco:{width:32,height:32,borderRadius:16,backgroundColor:AB,alignItems:"center",justifyContent:"center"},
  mName:{fontSize:13,fontWeight:"600",color:TX,textTransform:"capitalize"},
  mDate:{fontSize:10,color:TM,marginTop:1},
  mVal:{fontSize:16,fontWeight:"700",color:AL},
  moodRow:{flexDirection:"row",justifyContent:"space-around",paddingTop:4},
  moodItem:{alignItems:"center",gap:4},
  moodScore:{fontSize:12,fontWeight:"700",color:TM},
});
