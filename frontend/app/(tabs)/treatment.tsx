import{useCallback,useState}from"react";
import{View,Text,StyleSheet,ScrollView,TextInput,TouchableOpacity,Modal,Platform}from"react-native";
import{SafeAreaView}from"react-native-safe-area-context";
import{Ionicons}from"@expo/vector-icons";
import{useFocusEffect}from"expo-router";
import*as Haptics from"expo-haptics";
import{AddMedicationSheet}from"@/src/components/AddMedicationSheet";
import{api}from"@/src/lib/api";
import{resyncReminders}from"@/src/lib/notifications";

const BG="#161826",SF="#232532",SF2="#1e2030",TX="#e9e9ed",TM="rgba(233,233,237,0.5)",TD="rgba(233,233,237,0.3)",AC="#9184d9",AL="#a7a1db",AB="rgba(145,132,217,0.16)",ER="#e58585",EB="rgba(229,133,133,0.12)";

const TABS=[{key:"medications",label:"Medications",icon:"medical-outline"},{key:"measurements",label:"Measurements",icon:"pulse-outline"},{key:"activities",label:"Activities",icon:"body-outline"},{key:"mood",label:"Mood",icon:"heart-outline"}];
const MOOD_EMOJI=["","😟","😔","😐","😊","😄"];
const MOOD_COLORS=["","#e58585","#e5b285","#9184d9","#85c1e5","#85e5a5"];

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

  const load=useCallback(async()=>{
    try{
      const[m,mes,act,mo,mc,ac]=await Promise.all([api.listMedications(true),api.listMeasurements(),api.listActivities(),api.listMood(),api.measurementCatalog(),api.activityCatalog()]);
      setMeds(m);setMeasurements(mes);setActivities(act);setMood(mo);setCatalog({measurements:mc.measurements,activities:ac.activities});
      resyncReminders().catch(()=>{});
    }catch{}
  },[]);
  useFocusEffect(useCallback(()=>{load();},[load]));

  const submitMeasurement=async()=>{
    if(!measureModal.type||!vPrimary)return;
    setSaving(true);
    try{
      await api.createMeasurement({type:measureModal.type.key,value:parseFloat(vPrimary),value_secondary:vSecondary?parseFloat(vSecondary):undefined,unit:measureModal.type.unit,note:vNote||undefined});
      setMeasureModal({open:false,type:null});setVPrimary("");setVSecondary("");setVNote("");
      load();
    }catch{}finally{setSaving(false);}
  };

  const submitActivity=async()=>{
    if(!actModal.type||!vPrimary)return;
    setSaving(true);
    try{
      await api.createActivity({type:actModal.type.key,value:parseFloat(vPrimary),unit:actModal.type.unit,note:vNote||undefined});
      setActModal({open:false,type:null});setVPrimary("");setVNote("");
      load();
    }catch{}finally{setSaving(false);}
  };

  const submitMood=async()=>{
    setSaving(true);
    try{
      await api.createMood({score:moodScore,note:moodNote||undefined});
      setMoodNote("");setMoodScore(3);load();
    }catch{}finally{setSaving(false);}
  };

  return(
    <SafeAreaView style={s.safe}edges={["top"]}>
      {/* Header */}
      <View style={s.hdr}>
        <Text style={s.title}>Treatment</Text>
        {active==="medications"&&(<TouchableOpacity style={s.addBtn}onPress={()=>setAddMed(true)}><Ionicons name="add"size={22}color={AL}/></TouchableOpacity>)}
      </View>

      {/* Tab strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}contentContainerStyle={s.tabs}>
        {TABS.map(t=>(<TouchableOpacity key={t.key}onPress={()=>setActive(t.key)}style={[s.tab,active===t.key&&s.tabOn]}>
          <Ionicons name={t.icon as any}size={14}color={active===t.key?AL:TM}/>
          <Text style={[s.tabTx,active===t.key&&s.tabTxOn]}>{t.label}</Text>
        </TouchableOpacity>))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.body}showsVerticalScrollIndicator={false}>

        {/* ── MEDICATIONS ── */}
        {active==="medications"&&(<View style={s.section}>
          {meds.length===0?(<View style={s.empty}><Ionicons name="medical-outline"size={32}color={AC}/><Text style={s.emTitle}>No medications</Text><Text style={s.emSub}>Tap + to add your first medication</Text></View>
          ):meds.map(m=>(<View key={m.id}style={s.card}>
            <View style={s.cardRow}>
              <View style={s.cardIco}><Ionicons name="medical-outline"size={17}color={AL}/></View>
              <View style={{flex:1}}>
                <Text style={s.cardTitle}>{m.name}</Text>
                <Text style={s.cardSub}>{m.dosage?`${m.dosage} ${m.unit}`:m.unit||""}</Text>
              </View>
              {m.stock<=m.refill_threshold&&(<View style={s.refillBadge}><Text style={s.refillTx}>Refill Soon</Text></View>)}
            </View>
            <View style={s.cardFooter}>
              <View style={s.footRow}><Ionicons name="calendar-outline"size={11}color={AL}/><Text style={s.footTx}>{(m.times||[]).join(" • ")||"No times set"}</Text></View>
              <Text style={s.footTx}>{m.stock} left</Text>
            </View>
          </View>))}
        </View>)}

        {/* ── MEASUREMENTS ── */}
        {active==="measurements"&&(<View style={s.section}>
          <Text style={s.sectionTitle}>Log a measurement</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}contentContainerStyle={{gap:8,paddingBottom:4}}>
            {(catalog?.measurements||[]).map((mt:any)=>(<TouchableOpacity key={mt.key}style={s.catChip}onPress={()=>{setMeasureModal({open:true,type:mt});setVPrimary("");setVSecondary("");setVNote("");}}>
              <Ionicons name="pulse-outline"size={13}color={AL}/>
              <Text style={s.catChipTx}>{mt.label}</Text>
            </TouchableOpacity>))}
          </ScrollView>
          {measurements.length>0&&(<><Text style={[s.sectionTitle,{marginTop:16}]}>Recent</Text>
          {measurements.slice(0,10).map((m:any,i:number)=>(<View key={i}style={[s.card,{gap:4}]}>
            <View style={s.cardRow}>
              <View style={s.cardIco}><Ionicons name="pulse-outline"size={15}color={AL}/></View>
              <View style={{flex:1}}><Text style={s.cardTitle}>{m.type?.replace(/_/g," ")}</Text><Text style={s.cardSub}>{new Date(m.recorded_at).toLocaleDateString()}</Text></View>
              <Text style={s.bigVal}>{m.value}{m.value_secondary?`/${m.value_secondary}`:""}<Text style={{fontSize:11,color:TM}}> {m.unit}</Text></Text>
            </View>
          </View>))}</>)}
        </View>)}

        {/* ── ACTIVITIES ── */}
        {active==="activities"&&(<View style={s.section}>
          <Text style={s.sectionTitle}>Log an activity</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}contentContainerStyle={{gap:8,paddingBottom:4}}>
            {(catalog?.activities||[]).map((at:any)=>(<TouchableOpacity key={at.key}style={s.catChip}onPress={()=>{setActModal({open:true,type:at});setVPrimary("");setVNote("");}}>
              <Ionicons name="body-outline"size={13}color={AL}/>
              <Text style={s.catChipTx}>{at.label}</Text>
            </TouchableOpacity>))}
          </ScrollView>
          {activities.length>0&&(<><Text style={[s.sectionTitle,{marginTop:16}]}>Recent</Text>
          {activities.slice(0,10).map((a:any,i:number)=>(<View key={i}style={s.card}>
            <View style={s.cardRow}>
              <View style={s.cardIco}><Ionicons name="body-outline"size={15}color={AL}/></View>
              <View style={{flex:1}}><Text style={s.cardTitle}>{a.type?.replace(/_/g," ")}</Text><Text style={s.cardSub}>{new Date(a.recorded_at).toLocaleDateString()}</Text></View>
              <Text style={s.bigVal}>{a.value}<Text style={{fontSize:11,color:TM}}> {a.unit}</Text></Text>
            </View>
          </View>))}</>)}
        </View>)}

        {/* ── MOOD ── */}
        {active==="mood"&&(<View style={s.section}>
          <View style={s.card}>
            <Text style={s.sectionTitle}>How are you feeling today?</Text>
            <View style={s.moodRow}>
              {[1,2,3,4,5].map(n=>(<TouchableOpacity key={n}onPress={()=>setMoodScore(n)}style={[s.moodBtn,moodScore===n&&{borderColor:MOOD_COLORS[n],backgroundColor:`${MOOD_COLORS[n]}22`}]}>
                <Text style={{fontSize:24}}>{MOOD_EMOJI[n]}</Text>
                <Text style={[s.moodNum,moodScore===n&&{color:MOOD_COLORS[n]}]}>{n}</Text>
              </TouchableOpacity>))}
            </View>
            <TextInput value={moodNote}onChangeText={setMoodNote}placeholder="Add a note (optional)"placeholderTextColor={TM}style={s.input}multiline/>
            <TouchableOpacity style={s.submitBtn}onPress={submitMood}disabled={saving}>
              <Text style={s.submitTx}>{saving?"Saving…":"Log Mood"}</Text>
            </TouchableOpacity>
          </View>
          {mood.length>0&&(<><Text style={[s.sectionTitle,{marginTop:16}]}>Recent</Text>
          {mood.slice(0,7).map((m:any,i:number)=>(<View key={i}style={s.card}>
            <View style={s.cardRow}>
              <Text style={{fontSize:24}}>{MOOD_EMOJI[m.score]||"😐"}</Text>
              <View style={{flex:1,marginLeft:12}}><Text style={s.cardTitle}>Mood: {m.score}/5</Text><Text style={s.cardSub}>{new Date(m.recorded_at).toLocaleDateString()}</Text></View>
              {m.note&&<Text style={[s.cardSub,{maxWidth:120,textAlign:"right"}]}>{m.note}</Text>}
            </View>
          </View>))}</>)}
        </View>)}

      </ScrollView>

      {/* Measurement Modal */}
      <Modal visible={measureModal.open}transparent animationType="slide"onRequestClose={()=>setMeasureModal({open:false,type:null})}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{measureModal.type?.label}</Text>
            <Text style={s.modalSub}>Unit: {measureModal.type?.unit}</Text>
            <TextInput value={vPrimary}onChangeText={setVPrimary}keyboardType="decimal-pad"placeholder={measureModal.type?.composite?`${measureModal.type.composite[0]} value`:"Value"}placeholderTextColor={TM}style={s.input}/>
            {measureModal.type?.composite&&(<TextInput value={vSecondary}onChangeText={setVSecondary}keyboardType="decimal-pad"placeholder={measureModal.type.composite[1]+" value"}placeholderTextColor={TM}style={s.input}/>)}
            <TextInput value={vNote}onChangeText={setVNote}placeholder="Note (optional)"placeholderTextColor={TM}style={s.input}/>
            <TouchableOpacity style={s.submitBtn}onPress={submitMeasurement}disabled={saving||!vPrimary}><Text style={s.submitTx}>{saving?"Saving…":"Save"}</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn}onPress={()=>setMeasureModal({open:false,type:null})}><Text style={s.cancelTx}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Activity Modal */}
      <Modal visible={actModal.open}transparent animationType="slide"onRequestClose={()=>setActModal({open:false,type:null})}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{actModal.type?.label}</Text>
            <Text style={s.modalSub}>Unit: {actModal.type?.unit}</Text>
            <TextInput value={vPrimary}onChangeText={setVPrimary}keyboardType="decimal-pad"placeholder="Value"placeholderTextColor={TM}style={s.input}/>
            <TextInput value={vNote}onChangeText={setVNote}placeholder="Note (optional)"placeholderTextColor={TM}style={s.input}/>
            <TouchableOpacity style={s.submitBtn}onPress={submitActivity}disabled={saving||!vPrimary}><Text style={s.submitTx}>{saving?"Saving…":"Save"}</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn}onPress={()=>setActModal({open:false,type:null})}><Text style={s.cancelTx}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AddMedicationSheet visible={addMed}onClose={()=>setAddMed(false)}onSaved={()=>{setAddMed(false);load();}}/>
    </SafeAreaView>
  );
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:BG},hdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingTop:10,paddingBottom:4},title:{fontSize:20,fontWeight:"700",color:TX,letterSpacing:-0.4},addBtn:{width:36,height:36,borderRadius:18,backgroundColor:AB,alignItems:"center",justifyContent:"center"},tabs:{paddingHorizontal:16,paddingVertical:10,gap:8},tab:{flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:14,height:34,borderRadius:17,borderWidth:1,borderColor:"rgba(233,233,237,0.12)"},tabOn:{backgroundColor:AB,borderColor:AC},tabTx:{fontSize:12,color:TM,fontWeight:"600"},tabTxOn:{color:AL},body:{padding:16,paddingBottom:100},section:{gap:10},sectionTitle:{fontSize:13,fontWeight:"700",color:TX,marginBottom:4},card:{backgroundColor:SF,borderRadius:14,padding:14,gap:8},cardRow:{flexDirection:"row",alignItems:"center",gap:10},cardIco:{width:36,height:36,borderRadius:12,backgroundColor:AB,alignItems:"center",justifyContent:"center"},cardTitle:{fontSize:14,fontWeight:"600",color:TX},cardSub:{fontSize:11,color:TM,marginTop:1},cardFooter:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingTop:8,borderTopWidth:1,borderTopColor:"rgba(233,233,237,0.08)"},footRow:{flexDirection:"row",alignItems:"center",gap:4},footTx:{fontSize:11,color:TM},refillBadge:{paddingHorizontal:8,paddingVertical:3,borderRadius:8,backgroundColor:"rgba(167,161,219,0.2)"},refillTx:{fontSize:10,color:AL,fontWeight:"600"},bigVal:{fontSize:18,fontWeight:"700",color:AL},catChip:{flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:12,height:34,borderRadius:17,backgroundColor:SF,borderWidth:1,borderColor:"rgba(233,233,237,0.12)"},catChipTx:{fontSize:12,color:TM,fontWeight:"600"},moodRow:{flexDirection:"row",justifyContent:"space-between",marginVertical:8},moodBtn:{alignItems:"center",gap:4,padding:8,borderRadius:12,borderWidth:1.5,borderColor:"rgba(233,233,237,0.12)",flex:1,margin:2},moodNum:{fontSize:11,color:TM,fontWeight:"700"},input:{backgroundColor:SF2,borderRadius:10,padding:12,color:TX,fontSize:15,borderWidth:1,borderColor:"rgba(233,233,237,0.1)",marginTop:4},submitBtn:{backgroundColor:AC,borderRadius:12,padding:14,alignItems:"center",marginTop:8},submitTx:{color:"#fff",fontWeight:"700",fontSize:15},cancelBtn:{borderRadius:12,padding:12,alignItems:"center"},cancelTx:{color:TM,fontSize:14},modalOverlay:{flex:1,backgroundColor:"rgba(0,0,0,0.7)",justifyContent:"flex-end"},modal:{backgroundColor:SF,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,gap:10},modalTitle:{fontSize:18,fontWeight:"700",color:TX},modalSub:{fontSize:12,color:TM},empty:{backgroundColor:SF,borderRadius:18,padding:32,alignItems:"center",gap:8},emTitle:{fontSize:16,fontWeight:"700",color:TX},emSub:{fontSize:13,color:TM,textAlign:"center"}});
