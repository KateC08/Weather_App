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
    document.getElementById("temperature").innerText =
      data[0].temperature + " °C";

    document.getElementById("humidity").innerText =
      data[0].humidity + " %";
  }
}

fetchWeather();
setInterval(fetchWeather, 5000);