import{useCallback,useState}from"react";
import{View,Text,StyleSheet,ScrollView,TouchableOpacity,TextInput,Linking,Alert}from"react-native";
import{SafeAreaView}from"react-native-safe-area-context";
import{Ionicons}from"@expo/vector-icons";
import{useRouter}from"expo-router";
import{signOut}from"@/src/lib/auth";

const BG="#161826",SF="#232532",TX="#e9e9ed",TM="rgba(233,233,237,0.55)",AC="#9184d9",A3="#a7a1db",AB="rgba(145,132,217,0.14)",BORDER="rgba(233,233,237,0.1)";

const QUICK_ACTIONS=[
  {icon:"call-outline",label:"Call Doctor"},
  {icon:"calendar-outline",label:"Book Appointment"},
  {icon:"document-text-outline",label:"My Reports"},
  {icon:"person-outline",label:"My Profile"},
];

const FAQS=[
  "How do I add a new medication?",
  "Can I set multiple reminders?",
  "How does the caregiver alert work?",
  "How do I log my blood pressure?",
];

export default function Support(){
  const router=useRouter();
  const[search,setSearch]=useState("");
  const[signingOut,setSigningOut]=useState(false);

  const handleSignOut=async()=>{
    Alert.alert("Sign out","Are you sure you want to sign out?",[
      {text:"Cancel",style:"cancel"},
      {text:"Sign out",style:"destructive",onPress:async()=>{
        setSigningOut(true);
        try{await signOut();router.replace("/sign-in");}
        catch{setSigningOut(false);}
      }},
    ]);
  };

  return(
    <SafeAreaView style={s.safe}edges={["top"]}>
      <View style={s.hdr}><Text style={s.title}>Support</Text></View>

      <ScrollView contentContainerStyle={s.body}showsVerticalScrollIndicator={false}>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search-outline"size={14}color={TM}style={{position:"absolute",left:12,zIndex:1}}/>
          <TextInput value={search}onChangeText={setSearch}placeholder="Search for help"placeholderTextColor={TM}style={s.searchInput}/>
        </View>

        {/* Quick actions 2x2 grid - exactly like design */}
        <View style={s.grid}>
          {QUICK_ACTIONS.map(q=>(<TouchableOpacity key={q.label}style={s.qCard}>
            <View style={s.qIco}><Ionicons name={q.icon as any}size={15}color={A3}/></View>
            <Text style={s.qLbl}>{q.label}</Text>
          </TouchableOpacity>))}
        </View>

        {/* Ask PillCare AI - highlighted card from design */}
        <View style={[s.card,{flexDirection:"row",gap:12,borderColor:"rgba(145,132,217,0.3)"}]}>
          <View style={[s.qIco,{width:36,height:36,borderRadius:18}]}><Ionicons name="sparkles"size={17}color={A3}/></View>
          <View style={{flex:1}}>
            <Text style={s.cardTitle}>Ask PillCare AI</Text>
            <Text style={s.cardSub}>Get instant answers about your meds</Text>
          </View>
          <TouchableOpacity style={s.chatBtn}><Text style={s.chatTx}>Chat</Text></TouchableOpacity>
        </View>

        {/* FAQs */}
        <Text style={s.secLbl}>FREQUENTLY ASKED</Text>
        {FAQS.filter(f=>!search||f.toLowerCase().includes(search.toLowerCase())).map((f,i)=>(
          <TouchableOpacity key={i}style={s.card}>
            <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
              <Text style={[s.cardTitle,{flex:1}]}>{f}</Text>
              <Ionicons name="chevron-forward"size={13}color={TM}/>
            </View>
          </TouchableOpacity>
        ))}

        {/* Contact us */}
        <Text style={s.secLbl}>CONTACT US</Text>
        <TouchableOpacity style={s.card}onPress={()=>Linking.openURL("mailto:support@pillcare.app")}>
          <View style={{flexDirection:"row",alignItems:"center",gap:10}}>
            <View style={s.cardIco}><Ionicons name="mail-outline"size={16}color={A3}/></View>
            <View><Text style={s.cardTitle}>Email Support</Text><Text style={s.cardSub}>support@pillcare.app • replies in 24h</Text></View>
          </View>
        </TouchableOpacity>

        {/* Privacy */}
        <TouchableOpacity style={s.card}>
          <View style={{flexDirection:"row",alignItems:"center",gap:10}}>
            <View style={s.cardIco}><Ionicons name="lock-closed-outline"size={16}color={A3}/></View>
            <View><Text style={s.cardTitle}>Privacy Policy</Text><Text style={s.cardSub}>How we handle your health data</Text></View>
            <Ionicons name="chevron-forward"size={13}color={TM}style={{marginLeft:"auto"}}/>
          </View>
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity style={[s.card,{borderColor:"rgba(229,133,133,0.2)"}]}onPress={handleSignOut}>
          <View style={{flexDirection:"row",alignItems:"center",gap:10}}>
            <View style={[s.cardIco,{backgroundColor:"rgba(229,133,133,0.1)"}]}><Ionicons name="log-out-outline"size={16}color="#e58585"/></View>
            <Text style={[s.cardTitle,{color:"#e58585"}]}>{signingOut?"Signing out…":"Sign Out"}</Text>
          </View>
        </TouchableOpacity>

        <View style={s.footer}>
          <Ionicons name="lock-closed-outline"size={11}color={TM}/>
          <Text style={s.footerTx}>Your data is safe and secure with us.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:BG},hdr:{paddingHorizontal:16,paddingTop:10,paddingBottom:6},title:{fontSize:20,fontWeight:"700",color:TX,letterSpacing:-.4},body:{padding:16,paddingBottom:110,gap:10},searchWrap:{position:"relative",justifyContent:"center"},searchInput:{backgroundColor:SF,borderRadius:10,padding:12,paddingLeft:34,color:TX,fontSize:13,borderWidth:1,borderColor:BORDER},grid:{flexDirection:"row",flexWrap:"wrap",gap:8},qCard:{width:"48%",backgroundColor:SF,borderRadius:14,padding:12,alignItems:"center",gap:6,borderWidth:1,borderColor:BORDER},qIco:{width:32,height:32,borderRadius:16,backgroundColor:AB,alignItems:"center",justifyContent:"center"},qLbl:{fontSize:11,fontWeight:"600",color:TX,textAlign:"center"},card:{backgroundColor:SF,borderRadius:14,padding:13,gap:6,borderWidth:1,borderColor:BORDER},cardIco:{width:34,height:34,borderRadius:10,backgroundColor:AB,alignItems:"center",justifyContent:"center"},cardTitle:{fontSize:13,fontWeight:"600",color:TX},cardSub:{fontSize:10,color:TM,marginTop:1},chatBtn:{paddingHorizontal:12,height:30,borderRadius:8,backgroundColor:AC,alignItems:"center",justifyContent:"center"},chatTx:{color:"#fff",fontWeight:"700",fontSize:11},secLbl:{fontSize:10,letterSpacing:1,color:TM,fontWeight:"700",marginTop:4},footer:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,paddingVertical:8},footerTx:{fontSize:10,color:TM}});
"""