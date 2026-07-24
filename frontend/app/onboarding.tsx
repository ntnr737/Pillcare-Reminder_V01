import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { theme } from "@/src/lib/theme";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { api } from "@/src/lib/api";
import { getStoredUser } from "@/src/lib/auth";
const GENDERS=["Female","Male","Non-binary","Prefer not to say"];
const CY=new Date().getFullYear();
function fmtTime(d:Date){return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
export default function Onboarding(){
  const router=useRouter();
  const [step,setStep]=useState(0);
  const [nickname,setNickname]=useState("");
  const [gender,setGender]=useState(GENDERS[0]);
  const [yob,setYob]=useState(String(CY-30));
  const [phone,setPhone]=useState("");
  const [city,setCity]=useState("");
  const [state,setState]=useState("");
  const [locLoading,setLocLoading]=useState(false);
  const [locError,setLocError]=useState("");
  const [routine,setRoutine]=useState({routine_wake:"07:00",routine_breakfast:"08:00",routine_lunch:"13:00",routine_dinner:"19:00",routine_sleep:"22:00"});
  const [activePicker,setActivePicker]=useState<keyof typeof routine|null>(null);
  const [saving,setSaving]=useState(false);
  const TOTAL=4;
  useEffect(()=>{getStoredUser().then(u=>{if(u?.name&&!nickname)setNickname(u.name);});},[]);
  const fetchGPS=async()=>{
    setLocLoading(true);setLocError("");
    try{
      const {status}=await Location.requestForegroundPermissionsAsync();
      if(status!=="granted"){setLocError("Permission denied. You can type your city below.");setLocLoading(false);return;}
      const pos=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      const geo=await Location.reverseGeocodeAsync({latitude:pos.coords.latitude,longitude:pos.coords.longitude});
      if(geo.length>0){setCity(geo[0].city||geo[0].subregion||"");setState(geo[0].region||"");}
    }catch(e){setLocError("Could not detect location. Type it below.");}
    finally{setLocLoading(false);}
  };
  useEffect(()=>{if(step===2&&!city)fetchGPS();},[step]);
  const next=()=>setStep(s=>Math.min(TOTAL-1,s+1));
  const back=()=>setStep(s=>Math.max(0,s-1));
  const submit=async()=>{
    setSaving(true);
    try{
      await api.upsertProfile({nickname:nickname.trim()||"Friend",gender,year_of_birth:parseInt(yob)||CY-30,location_city:city.trim()||undefined,location_state:state.trim()||undefined,phone:phone.trim()||undefined,...routine});
      router.replace("/(tabs)/today");
    }catch(e){console.warn(e);}finally{setSaving(false);}
  };
  const canNext=step===0?nickname.trim().length>0:step===1?yob.length===4&&parseInt(yob)>1900&&parseInt(yob)<=CY:true;
  return(
    <SafeAreaView style={s.safe} edges={["top","bottom"]}>
      <View style={s.progress}>{Array.from({length:TOTAL}).map((_,i)=>(<View key={i} style={[s.dot,i<=step&&s.dotOn]}/>))}</View>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {step===0&&(
          <View testID="onboarding-step-1">
            <Text style={s.h1}>Welcome to PillCare</Text>
            <Text style={s.sub}>A calmer way to stay on top of your meds. What should we call you?</Text>
            <Text style={s.label}>Your name</Text>
            <TextInput testID="nickname-input" value={nickname} onChangeText={setNickname} placeholder="e.g. Nitin" placeholderTextColor={theme.colors.textSecondary} style={s.input} autoFocus/>
            <Text style={s.hint}>Pre-filled from your Google account — feel free to change it.</Text>
          </View>
        )}
        {step===1&&(
          <View testID="onboarding-step-2">
            <Text style={s.h1}>About you</Text>
            <Text style={s.sub}>Helps personalise reminders and reports.</Text>
            <Text style={s.label}>Gender</Text>
            <View style={s.chipRow}>{GENDERS.map(g=>(<TouchableOpacity key={g} testID={`gender-${g}`} onPress={()=>setGender(g)} style={[s.chip,gender===g&&s.chipOn]}><Text style={[s.chipText,gender===g&&s.chipTextOn]}>{g}</Text></TouchableOpacity>))}</View>
            <Text style={s.label}>Year of birth</Text>
            <TextInput testID="yob-input" value={yob} onChangeText={v=>setYob(v.replace(/[^0-9]/g,"").slice(0,4))} keyboardType="number-pad" placeholder="e.g. 1990" placeholderTextColor={theme.colors.textSecondary} style={s.input}/>
            <Text style={s.hint}>Year only — we never ask for your full date of birth.</Text>
            <Text style={s.label}>Phone number <Text style={s.optional}>(optional)</Text></Text>
            <TextInput testID="phone-input" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 XXXXX XXXXX" placeholderTextColor={theme.colors.textSecondary} style={s.input}/>
          </View>
        )}
        {step===2&&(
          <View testID="onboarding-step-3">
            <Text style={s.h1}>Your location</Text>
            <Text style={s.sub}>We store only your city and state — never exact coordinates.</Text>
            {locLoading?(<View style={s.locRow}><ActivityIndicator color={theme.colors.brand}/><Text style={s.locText}>Detecting your location…</Text></View>):(
              <>
                {city?(<View style={s.locCard}><Ionicons name="location" size={18} color={theme.colors.brand}/><Text style={s.locName}>{city}{state?`, ${state}`:""}</Text></View>):null}
                {locError?(<Text style={s.errText}>{locError}</Text>):null}
                <TouchableOpacity style={s.retry} onPress={fetchGPS}><Ionicons name="refresh-outline" size={15} color={theme.colors.brand}/><Text style={s.retryText}>Re-detect location</Text></TouchableOpacity>
                <Text style={s.label}>City</Text>
                <TextInput value={city} onChangeText={setCity} placeholder="e.g. Bengaluru" placeholderTextColor={theme.colors.textSecondary} style={s.input}/>
                <Text style={s.label}>State</Text>
                <TextInput value={state} onChangeText={setState} placeholder="e.g. Karnataka" placeholderTextColor={theme.colors.textSecondary} style={s.input}/>
              </>
            )}
          </View>
        )}
        {step===3&&(
          <View testID="onboarding-step-4">
            <Text style={s.h1}>Your daily routine</Text>
            <Text style={s.sub}>Reminders will respect your rhythm.</Text>
            {(Object.keys(routine) as (keyof typeof routine)[]).map(k=>(
              <TouchableOpacity key={k} testID={`routine-${k}`} style={s.routineRow} onPress={()=>setActivePicker(k)}>
                <Text style={s.routineLabel}>{k.replace("routine_","").replace(/^./,c=>c.toUpperCase())}</Text>
                <Text style={s.routineTime}>{routine[k]}</Text>
              </TouchableOpacity>
            ))}
            {activePicker&&(()=>{const [h,m]=routine[activePicker].split(":").map(Number);const pv=new Date();pv.setHours(h);pv.setMinutes(m);return(<DateTimePicker value={pv} mode="time" display={Platform.OS==="ios"?"spinner":"default"} onChange={(_,d)=>{const k=activePicker;setActivePicker(null);if(d&&k)setRoutine({...routine,[k]:fmtTime(d)});}}/>);})()}
          </View>
        )}
      </ScrollView>
      <View style={s.footer}>
        {step>0&&(<PrimaryButton label="Back" variant="ghost" onPress={back} testID="back-btn" style={{marginBottom:8}}/>)}
        {step<TOTAL-1?(<PrimaryButton label="Continue" onPress={next} disabled={!canNext} testID="continue-btn"/>):(<PrimaryButton label="Get Started" onPress={submit} loading={saving} testID="finish-onboarding-btn"/>)}
      </View>
    </SafeAreaView>
  );
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:theme.colors.bg},progress:{flexDirection:"row",gap:8,padding:16},dot:{flex:1,height:4,borderRadius:2,backgroundColor:theme.colors.borderSubtle},dotOn:{backgroundColor:theme.colors.brand},body:{padding:24,paddingBottom:32},h1:{color:theme.colors.textPrimary,fontSize:28,fontWeight:"700",marginBottom:8,letterSpacing:-0.5},sub:{color:theme.colors.textSecondary,fontSize:15,marginBottom:24,lineHeight:22},label:{color:theme.colors.textSecondary,fontSize:14,marginTop:16,marginBottom:8},optional:{fontWeight:"400",fontStyle:"italic"},hint:{color:theme.colors.textSecondary,fontSize:12,marginTop:6,fontStyle:"italic"},input:{backgroundColor:theme.colors.surface,borderRadius:12,padding:16,color:theme.colors.textPrimary,fontSize:18,borderWidth:1,borderColor:theme.colors.borderSubtle,minHeight:56},chipRow:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{paddingHorizontal:16,height:44,borderRadius:22,borderWidth:1,borderColor:theme.colors.borderSubtle,backgroundColor:theme.colors.surface,alignItems:"center",justifyContent:"center"},chipOn:{backgroundColor:theme.colors.brand,borderColor:theme.colors.brand},chipText:{color:theme.colors.textSecondary,fontWeight:"600"},chipTextOn:{color:theme.colors.textInverse},locRow:{flexDirection:"row",alignItems:"center",gap:12,padding:16},locText:{color:theme.colors.textSecondary},locCard:{flexDirection:"row",alignItems:"center",gap:8,backgroundColor:theme.colors.surface,borderRadius:12,padding:16,borderWidth:1,borderColor:theme.colors.brand,marginBottom:8},locName:{color:theme.colors.textPrimary,fontSize:16,fontWeight:"600"},errText:{color:theme.colors.textSecondary,fontSize:13,marginBottom:8},retry:{flexDirection:"row",alignItems:"center",gap:6,paddingVertical:8,marginBottom:16},retryText:{color:theme.colors.brand,fontSize:14,fontWeight:"600"},routineRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:16,paddingHorizontal:16,backgroundColor:theme.colors.surface,borderRadius:12,borderWidth:1,borderColor:theme.colors.borderSubtle,marginBottom:8},routineLabel:{color:theme.colors.textPrimary,fontSize:16,fontWeight:"600"},routineTime:{color:theme.colors.brand,fontSize:18,fontWeight:"700"},footer:{padding:16,paddingBottom:24,borderTopWidth:1,borderTopColor:theme.colors.borderSubtle}});
