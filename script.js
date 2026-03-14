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
