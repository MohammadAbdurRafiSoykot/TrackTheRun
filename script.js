let watchId = null;

document.addEventListener("DOMContentLoaded", async () => {
  // iOS 13+ requires a user gesture to allow motion sensors
  const askIOSPermission = async () => {
    const DM = window.DeviceMotionEvent;
    const DO = window.DeviceOrientationEvent;
    try {
      if (DM && DM.requestPermission) await DM.requestPermission();
      if (DO && DO.requestPermission) await DO.requestPermission();
    } catch (e) { console.warn("Sensor permission denied:", e); }
  };

  const startBtn = document.getElementById("startBtn");
  const stopBtn  = document.getElementById("stopBtn");

  // Leaflet map
  if (marker) { map.removeLayer(marker); marker = null; }
path.setLatLngs([]); // clear previous polyline
  const map = L.map("map");
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  let path = L.polyline([], { weight: 4 }).addTo(map);
  let marker;

  // UI helpers
  const set = (id, v) => (document.getElementById(id).textContent = String(v));

  // Motion/orientation listeners
  const onMotion = (e) => {
    const a = e.accelerationIncludingGravity || {};
    set("ax", (a.x ?? 0).toFixed(2));
    set("ay", (a.y ?? 0).toFixed(2));
    set("az", (a.z ?? 0).toFixed(2));
  };

  const onOrientation = (e) => {
    set("alpha", (e.alpha ?? 0).toFixed(1));
    set("beta",  (e.beta  ?? 0).toFixed(1));
    set("gamma", (e.gamma ?? 0).toFixed(1));
  };

  // --- Distance, Speed & Pace tracking ---
  let lastPos = null;
  let totalDistance = 0; // in meters
  let startTime = null;

  // Haversine formula
  const haversine = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => deg * Math.PI / 180;
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const onPos = (p) => {
    const { latitude, longitude, accuracy } = p.coords;
    set("lat", latitude.toFixed(6));
    set("lon", longitude.toFixed(6));
    set("acc", Math.round(accuracy));

    const latlng = [latitude, longitude];

    // Distance calc
    if (lastPos) {
      const d = haversine(lastPos[0], lastPos[1], latitude, longitude);
      if (d > 1) { // ignore GPS jitter <1m
        totalDistance += d;
        set("dist", (totalDistance/1000).toFixed(2) + " km");
      }
    }
    lastPos = [latitude, longitude];

    // Speed calc
    if (startTime) {
      const elapsedSec = (Date.now() - startTime) / 1000;
      const speed = (totalDistance / elapsedSec) * 3.6; // km/h
      set("speed", speed.toFixed(1) + " km/h");

      // Pace calc (min/km)
      if (totalDistance > 0) {
        const paceSecPerKm = elapsedSec / (totalDistance/1000);
        const min = Math.floor(paceSecPerKm / 60);
        const sec = Math.floor(paceSecPerKm % 60);
        set("pace", `${min}:${sec.toString().padStart(2,"0")} min/km`);
      }
    }

    if (!marker) {
      marker = L.marker(latlng).addTo(map);
      map.setView(latlng, 16);
    } else {
      marker.setLatLng(latlng);
    }
    path.addLatLng(latlng);
  };

  const onPosErr = (err) => console.warn("GPS error:", err);

  // Start/Stop
  const start = async () => {
    await askIOSPermission();
    window.addEventListener("devicemotion", onMotion);
    window.addEventListener("deviceorientation", onOrientation);
    if ("geolocation" in navigator) {
      startTime = Date.now();
      totalDistance = 0;
      lastPos = null;
      set("dist", "0 km");
      set("speed", "0 km/h");
      set("pace", "0:00 min/km");
      watchId = navigator.geolocation.watchPosition(onPos, onPosErr, {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      });
    } else {
      alert("Geolocation not supported.");
    }
    startBtn.disabled = true; stopBtn.disabled = false;
  };

  const stop = () => {
    window.removeEventListener("devicemotion", onMotion);
    window.removeEventListener("deviceorientation", onOrientation);
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    startBtn.disabled = false; stopBtn.disabled = true;
  };

  startBtn.addEventListener("click", start);
  stopBtn.addEventListener("click", stop);
  stopBtn.disabled = true;
});
