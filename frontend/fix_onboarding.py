content = open("app/onboarding.tsx").read()

old = r"""            {activePicker&&(<DateTimePicker value={()=>{const [h,m]=routine[activePicker].split(":").map(Number);const d=new Date();d.setHours(h);d.setMinutes(m);return d;}()} mode="time" display={Platform.OS==="ios"?"spinner":"default"} onChange={(_,d)=>{const k=activePicker;setActivePicker(null);if(d&&k)setRoutine({...routine,[k]:fmtTime(d)});}}/>)}"""

new = r"""            {activePicker&&(()=>{const [h,m]=routine[activePicker].split(":").map(Number);const pv=new Date();pv.setHours(h);pv.setMinutes(m);return(<DateTimePicker value={pv} mode="time" display={Platform.OS==="ios"?"spinner":"default"} onChange={(_,d)=>{const k=activePicker;setActivePicker(null);if(d&&k)setRoutine({...routine,[k]:fmtTime(d)});}}/>);})()}"""

assert content.count(old)==1, f"not found, occurrences: {content.count(old)}"
content = content.replace(old, new)
open("app/onboarding.tsx", "w").write(content)
print("onboarding.tsx fixed OK")
