import{useCallback,useState}from"react";
import{View,Text,StyleSheet,ScrollView,TextInput,TouchableOpacity,Modal}from"react-native";
import{SafeAreaView}from"react-native-safe-area-context";
import{Ionicons}from"@expo/vector-icons";
import{useFocusEffect}from"expo-router";
import{AddMedicationSheet}from"@/src/components/AddMedicationSheet";
import{api}from"@/src/lib/api";
import{resyncReminders}from"@/src/lib/notifications";

const BG="#161826",SF="#232532",N800="#3f424d",TX="#e9e9ed",TM="rgba(233,233,237,0.55)",AC="#9184d9",A3="#a7a1db",AB="rgba(145,132,217,0.14)",BORDER="rgba(233,233,237,0.1)";
const MOOD_EMOJI=["","😟","😔","😐","😊","😄"];
const MOOD_COLORS=["","#e58585","#e5b285","#a7a1db","#85c1e5","#85e5a5"];

export default function Treatment(){
  const[filter,setFilter]=useState("all");
  const[meds,setMeds]=useState<any[]>([]);
  const[catalog,setCatalog]=useState<any>(null);
  const[measurements,setMeasurements]=useState<any[]>([]);
  const[activities,setActivities]=useState<any[]>([]);
  const[mood,setMood]=useState<any[]>([]);
  const[addMed,setAddMed]=useState(false);
  const[sheet,setSheet]=useState(false);
  const[measureModal,setMeasureModal]=useState<{open:boolean,type:any}>({open:false,type:null});
  const[actModal,setActModal]=useState<{open:boolean,type:any}>({open:false,type:null});
  const[moodScore,setMoodScore]=useState(3);
  const[moodNote,setMoodNote]=useState("");
  const[vPrimary,setVPrimary]=useState("");
  const[vSecondary,setVSecondary]=useState("");
  const[vNote,setVNote]=useState("");
  const[saving,setSaving]=useState(false);

  const load=useCallback(async()=>{try{const[m,mes,act,mo,mc,ac]=await Promise.all([api.listMedications(true),api.listMeasurements(),api.listActivities(),api.listMood(),api.measurementCatalog(),api.activityCatalog()]);setMeds(m);setMeasurements(mes);setActivities(act);setMood(mo);setCatalog({measurements:mc.measurements,activities:ac.activities});resyncReminders().catch(()=>{});}catch{}},[]);
  useFocusEffect(useCallback(()=>{load();},[load]));

  const refillMeds=meds.filter(m=>m.stock<=m.refill_threshold);
  const filteredMeds=filter==="refill"?refillMeds:meds;

  const submitMeasurement=async()=>{if(!measureModal.type||!vPrimary)return;setSaving(true);try{await api.createMeasurement({type:measureModal.type.key,value:parseFloat(vPrimary),value_secondary:vSecondary?parseFloat(vSecondary):undefined,unit:measureModal.type.unit,note:vNote||undefined});setMeasureModal({open:false,type:null});setVPrimary("");setVSecondary("");setVNote("");load();}catch{}finally{setSaving(false);}};
  const submitActivity=async()=>{if(!actModal.type||!vPrimary)return;setSaving(true);try{await api.createActivity({type:actModal.type.key,value:parseFloat(vPrimary),unit:actModal.type.unit,note:vNote||undefined});setActModal({open:false,type:null});setVPrimary("");setVNote("");load();}catch{}finally{setSaving(false);}};
  const submitMood=async()=>{setSaving(true);try{await api.createMood({score:moodScore,note:moodNote||undefined});setMoodNote("");setMoodScore(3);load();}catch{}finally{setSaving(false);}};

  const SHEET_OPTIONS=[
    {icon:"medical-outline",title:"Add Medication",body:"Add a new medication to your routine",action:()=>{setSheet(false);setAddMed(true);}},
    {icon:"pulse-outline",title:"Log Measurement",body:"Record blood pressure, glucose, weight",action:()=>{setSheet(false);if(catalog?.measurements?.[0])setMeasureModal({open:true,type:catalog.measurements[0]});}},
    {icon:"body-outline",title:"Log Activity",body:"Record exercise, steps, or other activity",action:()=>{setSheet(false);if(catalog?.activities?.[0])setActModal({open:true,type:catalog.activities[0]});}},
    {icon:"heart-outline",title:"Log Mood",body:"Track your mood and wellbeing",action:()=>{setSheet(false);}},
  ];

  return(
    <SafeAreaView style={s.safe}edges={["top"]}>
      <View style={s.hdr}>
        <Text style={s.title}>Treatment</Text>
      </View>

      {/* Filter tags - exactly like design */}
      <View style={s.filterRow}>
        <TouchableOpacity onPress={()=>setFilter("all")}style={[s.tag,filter==="all"&&s.tagOn]}><Text style={[s.tagTx,filter==="all"&&s.tagTxOn]}>All ({meds.length})</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>setFilter("active")}style={[s.tag,filter==="active"&&s.tagOn]}><Text style={[s.tagTx,filter==="active"&&s.tagTxOn]}>Active</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>setFilter("refill")}style={[s.tag,filter==="refill"&&s.tagOn]}><Text style={[s.tagTx,filter==="refill"&&s.tagTxOn]}>Refill Soon</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body}showsVerticalScrollIndicator={false}>
        {filteredMeds.length===0?(
          <View style={s.empty}><View style={s.emIco}><Ionicons name="medical-outline"size={26}color={AC}/></View><Text style={s.emTitle}>No medications</Text><Text style={s.emSub}>Tap + to add one</Text></View>
        ):filteredMeds.map(m=>(<View key={m.id}style={s.card}>
          <View style={s.cardRow}>
            <View style={s.cardIco}><Ionicons name="medical-outline"size={17}color={A3}/></View>
            <View style={{flex:1}}>
              <Text style={s.cardTitle}>{m.name}</Text>
              <Text style={s.cardSub}>{m.dosage?`${m.dosage} ${m.unit}`:m.unit||""}</Text>
            </View>
            {m.stock<=m.refill_threshold&&(<View style={s.refillTag}><Text style={s.refillTx}>Refill Soon</Text></View>)}
          </View>
          <View style={s.cardFoot}>
            <View style={{flexDirection:"row",alignItems:"center",gap:5}}>
              <Ionicons name="calendar-check-outline"size={11}color={A3}/>
              <Text style={s.footTx}>{(m.times||[]).join(" • ")||"No times set"}</Text>
            </View>
            <Text style={s.footTx}>{m.stock} left</Text>
          </View>
        </View>))}

        {/* Measurements section */}
        {measurements.length>0&&(<>
          <Text style={s.secLabel}>RECENT MEASUREMENTS</Text>
          {measurements.slice(0,5).map((m:any,i:number)=>(<View key={i}style={s.card}>
            <View style={s.cardRow}>
              <View style={s.cardIco}><Ionicons name="pulse-outline"size={15}color={A3}/></View>
              <View style={{flex:1}}><Text style={s.cardTitle}>{m.type?.replace(/_/g," ")}</Text><Text style={s.cardSub}>{new Date(m.recorded_at).toLocaleDateString()}</Text></View>
              <Text style={{fontSize:16,fontWeight:"700",color:A3}}>{m.value}{m.value_secondary?`/${m.value_secondary}`:""}<Text style={{fontSize:10,color:TM}}> {m.unit}</Text></Text>
            </View>
          </View>))}
        </>)}

        {/* Activities section */}
        {activities.length>0&&(<>
          <Text style={s.secLabel}>RECENT ACTIVITIES</Text>
          {activities.slice(0,5).map((a:any,i:number)=>(<View key={i}style={s.card}>
            <View style={s.cardRow}>
              <View style={s.cardIco}><Ionicons name="body-outline"size={15}color={A3}/></View>
              <View style={{flex:1}}><Text style={s.cardTitle}>{a.type?.replace(/_/g," ")}</Text><Text style={s.cardSub}>{new Date(a.recorded_at).toLocaleDateString()}</Text></View>
              <Text style={{fontSize:16,fontWeight:"700",color:A3}}>{a.value}<Text style={{fontSize:10,color:TM}}> {a.unit}</Text></Text>
            </View>
          </View>))}
        </>)}

        {/* Mood section */}
        {mood.length>0&&(<>
          <Text style={s.secLabel}>MOOD LOG</Text>
          <View style={s.card}>
            <View style={s.moodRow}>
              {[1,2,3,4,5].map(n=>(<TouchableOpacity key={n}onPress={()=>setMoodScore(n)}style={[s.moodBtn,moodScore===n&&{borderColor:MOOD_COLORS[n],backgroundColor:`${MOOD_COLORS[n]}22`}]}>
                <Text style={{fontSize:22}}>{MOOD_EMOJI[n]}</Text>
                <Text style={[s.moodNum,moodScore===n&&{color:MOOD_COLORS[n]}]}>{n}</Text>
              </TouchableOpacity>))}
            </View>
            <TextInput value={moodNote}onChangeText={setMoodNote}placeholder="Add a note..."placeholderTextColor={TM}style={s.input}/>
            <TouchableOpacity style={s.submitBtn}onPress={submitMood}disabled={saving}><Text style={s.submitTx}>{saving?"Saving…":"Log Mood"}</Text></TouchableOpacity>
          </View>
          {mood.slice(0,3).map((m:any,i:number)=>(<View key={i}style={[s.card,{flexDirection:"row",alignItems:"center",gap:12}]}>
            <Text style={{fontSize:24}}>{MOOD_EMOJI[m.score]||"😐"}</Text>
            <View><Text style={s.cardTitle}>Mood {m.score}/5</Text><Text style={s.cardSub}>{new Date(m.recorded_at).toLocaleDateString()}</Text></View>
          </View>))}
        </>)}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab}onPress={()=>setSheet(true)}>
        <Ionicons name="add"size={24}color={BG}/>
      </TouchableOpacity>

      {/* Sheet modal - "What would you like to do?" */}
      <Modal visible={sheet}transparent animationType="slide"onRequestClose={()=>setSheet(false)}>
        <TouchableOpacity style={s.overlay}activeOpacity={1}onPress={()=>setSheet(false)}>
          <View style={s.sheetBox}>
            <View style={s.handle}/>
            <Text style={s.sheetTitle}>What would you like to do?</Text>
            {SHEET_OPTIONS.map(o=>(<TouchableOpacity key={o.title}style={s.sheetOpt}onPress={o.action}>
              <View style={s.cardIco}><Ionicons name={o.icon as any}size={17}color={TX}/></View>
              <View style={{flex:1}}><Text style={s.cardTitle}>{o.title}</Text><Text style={s.cardSub}>{o.body}</Text></View>
              <Ionicons name="chevron-forward"size={14}color={TM}/>
            </TouchableOpacity>))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Measurement Modal */}
      <Modal visible={measureModal.open}transparent animationType="slide"onRequestClose={()=>setMeasureModal({open:false,type:null})}>
        <View style={s.overlay}><View style={s.sheetBox}>
          <View style={s.handle}/>
          <Text style={s.sheetTitle}>{measureModal.type?.label}</Text>
          <TextInput value={vPrimary}onChangeText={setVPrimary}keyboardType="decimal-pad"placeholder="Value"placeholderTextColor={TM}style={s.input}/>
          {measureModal.type?.composite&&<TextInput value={vSecondary}onChangeText={setVSecondary}keyboardType="decimal-pad"placeholder="Second value"placeholderTextColor={TM}style={s.input}/>}
          <TextInput value={vNote}onChangeText={setVNote}placeholder="Note (optional)"placeholderTextColor={TM}style={s.input}/>
          <TouchableOpacity style={s.submitBtn}onPress={submitMeasurement}disabled={saving||!vPrimary}><Text style={s.submitTx}>{saving?"Saving…":"Save"}</Text></TouchableOpacity>
          <TouchableOpacity style={{padding:12,alignItems:"center"}}onPress={()=>setMeasureModal({open:false,type:null})}><Text style={{color:TM}}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* Activity Modal */}
      <Modal visible={actModal.open}transparent animationType="slide"onRequestClose={()=>setActModal({open:false,type:null})}>
        <View style={s.overlay}><View style={s.sheetBox}>
          <View style={s.handle}/>
          <Text style={s.sheetTitle}>{actModal.type?.label}</Text>
          <TextInput value={vPrimary}onChangeText={setVPrimary}keyboardType="decimal-pad"placeholder="Value"placeholderTextColor={TM}style={s.input}/>
          <TextInput value={vNote}onChangeText={setVNote}placeholder="Note (optional)"placeholderTextColor={TM}style={s.input}/>
          <TouchableOpacity style={s.submitBtn}onPress={submitActivity}disabled={saving||!vPrimary}><Text style={s.submitTx}>{saving?"Saving…":"Save"}</Text></TouchableOpacity>
          <TouchableOpacity style={{padding:12,alignItems:"center"}}onPress={()=>setActModal({open:false,type:null})}><Text style={{color:TM}}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <AddMedicationSheet visible={addMed}onClose={()=>setAddMed(false)}onSaved={()=>{setAddMed(false);load();}}/>
    </SafeAreaView>
  );
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:BG},hdr:{paddingHorizontal:16,paddingTop:10,paddingBottom:4},title:{fontSize:20,fontWeight:"700",color:TX,letterSpacing:-.4},filterRow:{flexDirection:"row",gap:7,paddingHorizontal:16,paddingBottom:10},tag:{paddingHorizontal:12,height:28,borderRadius:999,borderWidth:1,borderColor:BORDER,alignItems:"center",justifyContent:"center"},tagOn:{backgroundColor:AB,borderColor:AC},tagTx:{fontSize:11,color:TM,fontWeight:"600"},tagTxOn:{color:A3},body:{padding:16,paddingBottom:120,gap:10},card:{backgroundColor:SF,borderRadius:14,padding:13,gap:8,borderWidth:1,borderColor:BORDER},cardRow:{flexDirection:"row",alignItems:"center",gap:10},cardIco:{width:36,height:36,borderRadius:10,backgroundColor:AB,alignItems:"center",justifyContent:"center"},cardTitle:{fontSize:13,fontWeight:"600",color:TX},cardSub:{fontSize:10,color:TM,marginTop:1},cardFoot:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingTop:8,borderTopWidth:1,borderTopColor:BORDER},footTx:{fontSize:10,color:TM},refillTag:{paddingHorizontal:7,paddingVertical:2,borderRadius:6,backgroundColor:"rgba(167,161,219,0.18)"},refillTx:{fontSize:9,color:A3,fontWeight:"700"},secLabel:{fontSize:10,letterSpacing:1,color:TM,fontWeight:"700",marginTop:4},moodRow:{flexDirection:"row",justifyContent:"space-between",paddingVertical:4},moodBtn:{alignItems:"center",gap:3,padding:6,borderRadius:10,borderWidth:1.5,borderColor:BORDER,flex:1,margin:2},moodNum:{fontSize:10,color:TM,fontWeight:"700"},input:{backgroundColor:"#1e2030",borderRadius:10,padding:12,color:TX,fontSize:14,borderWidth:1,borderColor:BORDER,marginTop:4},submitBtn:{backgroundColor:AC,borderRadius:11,padding:13,alignItems:"center",marginTop:6},submitTx:{color:"#fff",fontWeight:"700",fontSize:14},fab:{position:"absolute",right:18,bottom:90,width:52,height:52,borderRadius:26,backgroundColor:AC,alignItems:"center",justifyContent:"center",elevation:6},overlay:{flex:1,backgroundColor:"rgba(0,0,0,0.55)",justifyContent:"flex-end"},sheetBox:{backgroundColor:N800,borderTopLeftRadius:22,borderTopRightRadius:22,padding:22,gap:12},handle:{width:36,height:4,borderRadius:2,backgroundColor:"rgba(233,233,237,0.2)",alignSelf:"center",marginBottom:6},sheetTitle:{fontSize:16,fontWeight:"700",color:TX},sheetOpt:{flexDirection:"row",alignItems:"center",gap:12,backgroundColor:SF,borderRadius:14,padding:13,borderWidth:1,borderColor:BORDER},empty:{backgroundColor:SF,borderRadius:14,padding:32,alignItems:"center",gap:8,borderWidth:1,borderColor:BORDER},emIco:{width:48,height:48,borderRadius:24,backgroundColor:AB,alignItems:"center",justifyContent:"center",marginBottom:2},emTitle:{fontSize:14,fontWeight:"700",color:TX},emSub:{fontSize:12,color:TM,textAlign:"center"}});
