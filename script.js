const supabaseUrl = "https://saawgnizjfsepeooahsk.supabase.co";
const supabaseKey = "sb_publishable_H5IRLcvWEIFWWFC1pUI2fw_lmDJD9V_";

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

async function fetchWeather() {

    const { data, error } = await supabaseClient
        .from('weather_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.log("ERROR:", error);
        return;
    }
    console.log("DATA:", data);

    if (data.length > 0) {
       document.getElementById("temperature").innerText = data[0].temperature + " °C";
       document.getElementById("humidity").innerText = data[0].humidity + " %";
    }

}
fetchWeather();
setInterval(fetchWeather, 5000);

//  Clock
function tickClock() {
    document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
setInterval(tickClock, 1000); 
tickClock();

// Particles
(function() {
    const c = document.getElementById('particles');
    for (let i = 0; i < 14; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;
            width:${1.5+Math.random()*2.5}px;height:${1.5+Math.random()*2.5}px;
            animation-delay:${Math.random()*10}s;animation-duration:${8+Math.random()*8}s;`;
        c.appendChild(p);
    }
})();
 
// Physics
function calcHeatIndex(T, H) {
    if (T < 27) return T;
    return +(-8.78469475556 + 1.61139411*T + 2.33854883889*H
        - 0.14611605*T*H - 0.012308094*T*T - 0.0164248277778*H*H
        + 0.002211732*T*T*H + 0.00072546*T*H*H
        - 0.000003582*T*T*H*H).toFixed(1);
}
function calcDewPoint(T, H) {
    const a=17.625, b=243.04, al=Math.log(H/100)+a*T/(b+T);
    return +(b*al/(a-al)).toFixed(1);
}
function calcAbsHumidity(T, H) {
    const es=6.112*Math.exp((17.67*T)/(T+243.5)), e=(H/100)*es;
    return +((216.7*e)/(273.15+T)).toFixed(2);
}
function getMold(H, T) {
    if (H>=80&&T>=20) return {label:'High', color:'#f87171'};
    if (H>=70&&T>=18) return {label:'Moderate', color:'#fbbf24'};
    return {label:'Low', color:'#4ade80'};
}
function getCondition(T, H) {
    if (T<20&&H<40) return {text:'Cool & Dry', badge:'😌 Comfortable'};
    if (T<20&&H>=70) return {text:'Cool & Humid', badge:'🌫️ Damp'};
    if (T<26&&H<60) return {text:'Comfortable', badge:'✅ Pleasant'};
    if (T>=32&&H>=80) return {text:'Hot & Very Humid', badge:'🥵 Extreme'};
    if (T>=26&&H>=60) return {text:'Warm & Humid', badge:'😓 Muggy'};
    if (T>=32) return {text:'Very Hot', badge:'🔥 Hot'};
    return {text:'Warm', badge:'🌤 Fair'};
}
 
window.updateDerived = function(T, H) {
    const hi = calcHeatIndex(T, H);
    const dp = calcDewPoint(T, H);
    const ah = calcAbsHumidity(T, H);
    const mold = getMold(H, T);
    const cond = getCondition(T, H);
    document.getElementById('m-hi').textContent = hi + '°C';
    document.getElementById('m-dp').textContent = dp + '°C';
    document.getElementById('m-ah').textContent = ah + ' g/m³';
    document.getElementById('m-mold').textContent = mold.label;
    document.getElementById('m-mold').style.color = mold.color;
    document.getElementById('feelsLike').textContent = hi + '°C';
    document.getElementById('dewPoint').textContent = dp + '°C';
    document.getElementById('conditionText').textContent = cond.text;
    document.getElementById('conditionBadge').textContent = cond.badge;
    document.getElementById('humBar').style.width = H + '%';
    document.getElementById('humBarPct').textContent = H + '%';
    document.getElementById('infoText').textContent =
        H >= 80 ? `Very high humidity (${H}%). Significant moisture — feels like ${hi}°C. Consider ventilation.`
        : H >= 60 ? `Moderate to high humidity at ${H}%. Perceived temperature is ${hi}°C due to moisture in the air.`
        : `Comfortable humidity at ${H}%. Dew point is ${dp}°C. Conditions are relatively pleasant.`;
};
 
updateDerived(33.9, 72.1);

