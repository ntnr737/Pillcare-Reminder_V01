import{useCallback,useState}from"react";
import{View,Text,StyleSheet,ScrollView,TextInput,TouchableOpacity,Modal}from"react-native";
import{SafeAreaView}from"react-native-safe-area-context";
import{Ionicons}from"@expo/vector-icons";
import{useFocusEffect}from"expo-router";
import*as Haptics from"expo-haptics";
import{AddMedicationSheet}from"@/src/components/AddMedicationSheet";
import{api}from"@/src/lib/api";
import{resyncReminders}from"@/src/lib/notifications";

const BG="#161826",SF="#232532",SF2="#3f424d",TX="#e9e9ed",TM="rgba(233,233,237,0.55)",AC="#9184d9",AL="#a7a1db",AB="rgba(145,132,217,0.14)",BORDER="rgba(233,233,237,0.1)";
const MOOD_EMOJI=["","😟","😔","😐","😊","😄"];
const MOOD_COLORS=["","#e58585","#e5b285","#a7a1db","#85c1e5","#85e5a5"];
const TABS=[{key:"medications",label:"Medications"},{key:"measurements",label:"Measurements"},{key:"activities",label:"Activities"},{key:"mood",label:"Mood"}];

export default function Treatment(){
  const[active,setActive]=useState("medications");
  const[meds,setMeds]=useState<any[]>([]);
  const[measurements,setMeasurements]=useState<any[]>([]);
  const[activities,setActivities]=useState<any[]>([]);
  const[mood,setMood]=useState<any[]>([]);
  const[catalog,setCatalog]=useState<any>(null);
  const[addMed,setAddMed]=useState(false);
  const[measureModal,setMeasureModal]=useState<{open:boolean,type:any}>({open:false,type:null});
  const[actModal,setActModal]=useState<{open:boolean,type:any}>({open:false,type:null});
  const[moodScore,setMoodScore]=useState(3);
  const[moodNote,setMoodNote]=useState("");
  const[vPrimary,setVPrimary]=useState("");
  const[vSecondary,setVSecondary]=useState("");
  const[vNote,setVNote]=useState("");
  const[saving,setSaving]=useState(false);
  const[filter,setFilter]=useState("all");

  const load=useCallback(async()=>{try{const[m,mes,act,mo,mc,ac]=await Promise.all([api.listMedications(true),api.listMeasurements(),api.listActivities(),api.listMood(),api.measurementCatalog(),api.activityCatalog()]);setMeds(m);setMeasurements(mes);setActivities(act);setMood(mo);setCatalog({measurements:mc.measurements,activities:ac.activities});resyncReminders().catch(()=>{});}catch{}},[]);
  useFocusEffect(useCallback(()=>{load();},[load]));

  const submitMeasurement=async()=>{if(!measureModal.type||!vPrimary)return;setSaving(true);try{await api.createMeasurement({type:measureModal.type.key,value:parseFloat(vPrimary),value_secondary:vSecondary?parseFloat(vSecondary):undefined,unit:measureModal.type.unit,note:vNote||undefined});setMeasureModal({open:false,type:null});setVPrimary("");setVSecondary("");setVNote("");load();}catch{}finally{setSaving(false);}};
  const submitActivity=async()=>{if(!actModal.type||!vPrimary)return;setSaving(true);try{await api.createActivity({type:actModal.type.key,value:parseFloat(vPrimary),unit:actModal.type.unit,note:vNote||undefined});setActModal({open:false,type:null});setVPrimary("");setVNote("");load();}catch{}finally{setSaving(false);}};
  const submitMood=async()=>{setSaving(true);try{await api.createMood({score:moodScore,note:moodNote||undefined});setMoodNote("");setMoodScore(3);load();}catch{}finally{setSaving(false);}};

  const filteredMeds=filter==="refill"?meds.filter(m=>m.stock<=m.refill_threshold):meds;

  return(
    <SafeAreaView style={s.safe}edges={["top"]}>
      <View style={s.hdr}>
        <Text style={s.title}>Treatment</Text>
        {active==="medications"&&(<TouchableOpacity style={s.iconBtn}onPress={()=>setAddMed(true)}><Ionicons name="add"size={20}color={TX}/></TouchableOpacity>)}
      </View>

      {/* Pill tab strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}contentContainerStyle={s.tabs}>
        {TABS.map(t=>(<TouchableOpacity key={t.key}onPress={()=>setActive(t.key)}style={[s.tab,active===t.key&&s.tabOn]}>
          <Text style={[s.tabTx,active===t.key&&s.tabTxOn]}>{t.label}</Text>
        </TouchableOpacity>))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.body}showsVerticalScrollIndicator={false}>

        {/* MEDICATIONS */}
        {active==="medications"&&(<View style={{gap:10}}>
          {/* Filter tags */}
          <View style={s.filterRow}>
            {["all","refill"].map(f=>(<TouchableOpacity key={f}onPress={()=>setFilter(f)}style={[s.filterTag,filter===f&&s.filterTagOn]}><Text style={[s.filterTx,filter===f&&{color:AL}]}>{f==="all"?`All (${meds.length})`:"Refill Soon"}</Text></TouchableOpacity>))}
          </View>
          {filteredMeds.length===0?(
            <View style={s.empty}><View style={s.emIco}><Ionicons name="medical-outline"size={26}color={AC}/></View><Text style={s.emTitle}>No medications</Text><Text style={s.emSub}>Tap + to add one</Text></View>
          ):filteredMeds.map(m=>(<View key={m.id}style={s.card}>
            <View style={s.cardRow}>
              <View style={s.cardIco}><Ionicons name="medical-outline"size={17}color={AL}/></View>
              <View style={{flex:1}}>
                <Text style={s.cardTitle}>{m.name}</Text>
                <Text style={s.cardSub}>{m.dosage?`${m.dosage} ${m.unit}`:m.unit||""}</Text>
              </View>
              {m.stock<=m.refill_threshold&&(<View style={s.refillTag}><Text style={s.refillTx}>Refill Soon</Text></View>)}
            </View>
            <View style={s.cardFoot}>
              <View style={{flexDirection:"row",alignItems:"center",gap:5}}>
                <Ionicons name="calendar-check-outline"size={11}color={AL}/>
                <Text style={s.footTx}>{(m.times||[]).join(" • ")||"No times set"}</Text>
              </View>
              <Text style={s.footTx}>{m.stock} left</Text>
            </View>
          </View>))}
        </View>)}

        {/* MEASUREMENTS */}
        {active==="measurements"&&(<View style={{gap:10}}>
          <Text style={s.secTitle}>Log a measurement</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}contentContainerStyle={{gap:6,paddingBottom:2}}>
            {(catalog?.measurements||[]).map((mt:any)=>(<TouchableOpacity key={mt.key}style={s.chip}onPress={()=>{setMeasureModal({open:true,type:mt});setVPrimary("");setVSecondary("");setVNote("");}}>
              <Text style={s.chipTx}>{mt.label}</Text>
            </TouchableOpacity>))}
          </ScrollView>
          {measurements.length>0&&(<><Text style={[s.secTitle,{marginTop:8}]}>Recent</Text>{measurements.slice(0,8).map((m:any,i:number)=>(<View key={i}style={[s.card,{gap:0,paddingVertical:10}]}><View style={s.cardRow}><View style={s.cardIco}><Ionicons name="pulse-outline"size={15}color={AL}/></View><View style={{flex:1}}><Text style={s.cardTitle}>{m.type?.replace(/_/g," ")}</Text><Text style={s.cardSub}>{new Date(m.recorded_at).toLocaleDateString()}</Text></View><Text style={{fontSize:16,fontWeight:"700",color:AL}}>{m.value}{m.value_secondary?`/${m.value_secondary}`:""}<Text style={{fontSize:10,color:TM}}> {m.unit}</Text></Text></View></View>))}</>)}
        </View>)}

        {/* ACTIVITIES */}
        {active==="activities"&&(<View style={{gap:10}}>
          <Text style={s.secTitle}>Log an activity</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}contentContainerStyle={{gap:6,paddingBottom:2}}>
            {(catalog?.activities||[]).map((at:any)=>(<TouchableOpacity key={at.key}style={s.chip}onPress={()=>{setActModal({open:true,type:at});setVPrimary("");setVNote("");}}>
              <Text style={s.chipTx}>{at.label}</Text>
            </TouchableOpacity>))}
          </ScrollView>
          {activities.length>0&&(<><Text style={[s.secTitle,{marginTop:8}]}>Recent</Text>{activities.slice(0,8).map((a:any,i:number)=>(<View key={i}style={[s.card,{gap:0,paddingVertical:10}]}><View style={s.cardRow}><View style={s.cardIco}><Ionicons name="body-outline"size={15}color={AL}/></View><View style={{flex:1}}><Text style={s.cardTitle}>{a.type?.replace(/_/g," ")}</Text><Text style={s.cardSub}>{new Date(a.recorded_at).toLocaleDateString()}</Text></View><Text style={{fontSize:16,fontWeight:"700",color:AL}}>{a.value}<Text style={{fontSize:10,color:TM}}> {a.unit}</Text></Text></View></View>))}</>)}
        </View>)}

        {/* MOOD */}
        {active==="mood"&&(<View style={{gap:10}}>
          <View style={s.card}>
            <Text style={s.cardTitle}>How are you feeling?</Text>
            <View style={s.moodRow}>
              {[1,2,3,4,5].map(n=>(<TouchableOpacity key={n}onPress={()=>setMoodScore(n)}style={[s.moodBtn,moodScore===n&&{borderColor:MOOD_COLORS[n],backgroundColor:`${MOOD_COLORS[n]}22`}]}>
                <Text style={{fontSize:22}}>{MOOD_EMOJI[n]}</Text>
                <Text style={[s.moodNum,moodScore===n&&{color:MOOD_COLORS[n]}]}>{n}</Text>
              </TouchableOpacity>))}
            </View>
            <TextInput value={moodNote}onChangeText={setMoodNote}placeholder="Add a note (optional)"placeholderTextColor={TM}style={s.input}multiline/>
            <TouchableOpacity style={s.submitBtn}onPress={submitMood}disabled={saving}><Text style={s.submitTx}>{saving?"Saving…":"Log Mood"}</Text></TouchableOpacity>
          </View>
          {mood.length>0&&(<><Text style={s.secTitle}>Recent</Text>{mood.slice(0,6).map((m:any,i:number)=>(<View key={i}style={[s.card,{flexDirection:"row",alignItems:"center",gap:12,paddingVertical:10}]}><Text style={{fontSize:24}}>{MOOD_EMOJI[m.score]||"😐"}</Text><View style={{flex:1}}><Text style={s.cardTitle}>Mood {m.score}/5</Text><Text style={s.cardSub}>{new Date(m.recorded_at).toLocaleDateString()}</Text></View>{m.note&&<Text style={[s.cardSub,{maxWidth:100,textAlign:"right"}]}>{m.note}</Text>}</View>))}</>)}
        </View>)}
      </ScrollView>

      {/* Measurement Modal */}
      <Modal visible={measureModal.open}transparent animationType="slide"onRequestClose={()=>setMeasureModal({open:false,type:null})}>
        <View style={s.overlay}><View style={s.modal}>
          <View style={s.modalHandle}/>
          <Text style={s.modalTitle}>{measureModal.type?.label}</Text>
          <Text style={s.modalSub}>Unit: {measureModal.type?.unit}</Text>
          <TextInput value={vPrimary}onChangeText={setVPrimary}keyboardType="decimal-pad"placeholder={measureModal.type?.composite?`${measureModal.type.composite[0]} value`:"Value"}placeholderTextColor={TM}style={s.input}/>
          {measureModal.type?.composite&&(<TextInput value={vSecondary}onChangeText={setVSecondary}keyboardType="decimal-pad"placeholder={`${measureModal.type.composite[1]} value`}placeholderTextColor={TM}style={s.input}/>)}
          <TextInput value={vNote}onChangeText={setVNote}placeholder="Note (optional)"placeholderTextColor={TM}style={s.input}/>
          <TouchableOpacity style={s.submitBtn}onPress={submitMeasurement}disabled={saving||!vPrimary}><Text style={s.submitTx}>{saving?"Saving…":"Save"}</Text></TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn}onPress={()=>setMeasureModal({open:false,type:null})}><Text style={s.cancelTx}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* Activity Modal */}
      <Modal visible={actModal.open}transparent animationType="slide"onRequestClose={()=>setActModal({open:false,type:null})}>
        <View style={s.overlay}><View style={s.modal}>
          <View style={s.modalHandle}/>
          <Text style={s.modalTitle}>{actModal.type?.label}</Text>
          <Text style={s.modalSub}>Unit: {actModal.type?.unit}</Text>
          <TextInput value={vPrimary}onChangeText={setVPrimary}keyboardType="decimal-pad"placeholder="Value"placeholderTextColor={TM}style={s.input}/>
          <TextInput value={vNote}onChangeText={setVNote}placeholder="Note (optional)"placeholderTextColor={TM}style={s.input}/>
          <TouchableOpacity style={s.submitBtn}onPress={submitActivity}disabled={saving||!vPrimary}><Text style={s.submitTx}>{saving?"Saving…":"Save"}</Text></TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn}onPress={()=>setActModal({open:false,type:null})}><Text style={s.cancelTx}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <AddMedicationSheet visible={addMed}onClose={()=>setAddMed(false)}onSaved={()=>{setAddMed(false);load();}}/>
    </SafeAreaView>
  );
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:BG},hdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:18,paddingTop:12,paddingBottom:4},title:{fontSize:20,fontWeight:"700",color:TX,letterSpacing:-.4},iconBtn:{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:BORDER,alignItems:"center",justifyContent:"center"},tabs:{paddingHorizontal:18,paddingVertical:8,gap:7},tab:{paddingHorizontal:14,height:32,borderRadius:999,borderWidth:1,borderColor:BORDER,alignItems:"center",justifyContent:"center"},tabOn:{backgroundColor:AB,borderColor:AC},tabTx:{fontSize:12,color:TM,fontWeight:"600"},tabTxOn:{color:AL},body:{padding:18,paddingBottom:110},filterRow:{flexDirection:"row",gap:7},filterTag:{paddingHorizontal:12,height:28,borderRadius:999,borderWidth:1,borderColor:BORDER,alignItems:"center",justifyContent:"center"},filterTagOn:{backgroundColor:AB,borderColor:AC},filterTx:{fontSize:11,color:TM,fontWeight:"600"},card:{backgroundColor:SF,borderRadius:14,padding:13,gap:8,borderWidth:1,borderColor:BORDER},cardRow:{flexDirection:"row",alignItems:"center",gap:10},cardIco:{width:36,height:36,borderRadius:10,backgroundColor:AB,alignItems:"center",justifyContent:"center"},cardTitle:{fontSize:13,fontWeight:"600",color:TX},cardSub:{fontSize:11,color:TM,marginTop:1},cardFoot:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingTop:8,borderTopWidth:1,borderTopColor:BORDER},footTx:{fontSize:10,color:TM},refillTag:{paddingHorizontal:7,paddingVertical:2,borderRadius:6,backgroundColor:"rgba(167,161,219,0.18)"},refillTx:{fontSize:9,color:AL,fontWeight:"700"},secTitle:{fontSize:12,fontWeight:"700",color:TX},chip:{paddingHorizontal:12,height:32,borderRadius:999,backgroundColor:SF,borderWidth:1,borderColor:BORDER,alignItems:"center",justifyContent:"center"},chipTx:{fontSize:11,color:TM,fontWeight:"600"},moodRow:{flexDirection:"row",justifyContent:"space-between",paddingVertical:6},moodBtn:{alignItems:"center",gap:3,padding:6,borderRadius:10,borderWidth:1.5,borderColor:BORDER,flex:1,margin:2},moodNum:{fontSize:10,color:TM,fontWeight:"700"},input:{backgroundColor:"#1e2030",borderRadius:10,padding:12,color:TX,fontSize:14,borderWidth:1,borderColor:BORDER,marginTop:4},submitBtn:{backgroundColor:AC,borderRadius:11,padding:13,alignItems:"center",marginTop:6},submitTx:{color:"#fff",fontWeight:"700",fontSize:14},cancelBtn:{borderRadius:11,padding:10,alignItems:"center"},cancelTx:{color:TM,fontSize:13},overlay:{flex:1,backgroundColor:"rgba(0,0,0,0.65)",justifyContent:"flex-end"},modal:{backgroundColor:SF,borderTopLeftRadius:22,borderTopRightRadius:22,padding:22,gap:10},modalHandle:{width:36,height:4,borderRadius:2,backgroundColor:"rgba(233,233,237,0.2)",alignSelf:"center",marginBottom:6},modalTitle:{fontSize:17,fontWeight:"700",color:TX},modalSub:{fontSize:11,color:TM},empty:{backgroundColor:SF,borderRadius:14,padding:32,alignItems:"center",gap:8,borderWidth:1,borderColor:BORDER},emIco:{width:48,height:48,borderRadius:24,backgroundColor:AB,alignItems:"center",justifyContent:"center",marginBottom:2},emTitle:{fontSize:14,fontWeight:"700",color:TX},emSub:{fontSize:12,color:TM,textAlign:"center"}});
