document.addEventListener("DOMContentLoaded", () => {
  // --- UI helpers ---
  const set = (id, v) => (document.getElementById(id).textContent = String(v));
  const startBtn = document.getElementById("startBtn");
  const stopBtn  = document.getElementById("stopBtn");

  // --- Map shows immediately ---
  const map = L.map("map").setView([0, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  let path = L.polyline([], { weight: 4 }).addTo(map);
  let marker;

  // --- Sensor availability + permission ---
  const hasMotion = "DeviceMotionEvent" in window;
  const hasOrientation = "DeviceOrientationEvent" in window;
  let motionGranted = false;
  let orientationGranted = false;

  async function askSensorPermission() {
    // Android/desktop: no requestPermission() -> assume available if APIs exist
    let ok = true;

    if (typeof window.DeviceMotionEvent?.requestPermission === "function") {
      try {
        motionGranted = (await window.DeviceMotionEvent.requestPermission()) === "granted";
      } catch { motionGranted = false; }
      ok = ok && motionGranted;
    } else {
      motionGranted = hasMotion;
    }

    if (typeof window.DeviceOrientationEvent?.requestPermission === "function") {
      try {
        orientationGranted = (await window.DeviceOrientationEvent.requestPermission()) === "granted";
      } catch { orientationGranted = false; }
      ok = ok && orientationGranted;
    } else {
      orientationGranted = hasOrientation;
    }

    if (!ok) {
      alert(
        "Motion access is blocked.\nOn iOS: Settings → Safari → Advanced → Motion & Orientation Access → ON, then press Start again."
      );
    }
    return ok;
  }

  // --- Motion/orientation listeners ---
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

  // pick best orientation event
  const orientationEvent =
    "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";

  // --- GPS / distance / speed / pace ---
  let watchId = null;
  let lastPos = null;
  let totalDistance = 0; // meters
  let startTime = null;

  const haversine = (lat1, lon1, lat2, lon2) => {
    const toRad = (d) => d * Math.PI / 180;
    const R = 6371000;
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

    if (lastPos) {
      const d = haversine(lastPos[0], lastPos[1], latitude, longitude);
      if (d > 1) { // ignore jitter
        totalDistance += d;
        set("dist", (totalDistance/1000).toFixed(2) + " km");
      }
    }
    lastPos = [latitude, longitude];

    if (startTime) {
      const elapsedSec = (Date.now() - startTime) / 1000;
      const speed = (totalDistance / elapsedSec) * 3.6; // km/h
      set("speed", speed.toFixed(1) + " km/h");
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

  // --- Start/Stop ---
  async function start() {
    // Clear previous run visuals
    if (marker) { map.removeLayer(marker); marker = null; }
    path.setLatLngs([]);

    // Reset stats
    totalDistance = 0;
    lastPos = null;
    startTime = Date.now();
    set("dist", "0 km"); set("speed", "0 km/h"); set("pace", "0:00 min/km");

    // Ask for sensor permission (iOS needs this on click)
    await askSensorPermission();

    // Attach listeners (will only fire if supported + permitted)
    window.addEventListener("devicemotion", onMotion, { passive: true });
    window.addEventListener(orientationEvent, onOrientation, { passive: true });

    // GPS
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(onPos, onPosErr, {
        enableHighAccuracy: true, maximumAge: 1000, timeout: 10000
      });
    } else {
      alert("Geolocation not supported on this device/browser.");
    }

    startBtn.disabled = true; stopBtn.disabled = false;
  }

  function stop() {
    window.removeEventListener("devicemotion", onMotion);
    window.removeEventListener(orientationEvent, onOrientation);
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    startBtn.disabled = false; stopBtn.disabled = true;
  }

  startBtn.addEventListener("click", start);
  stopBtn.addEventListener("click", stop);
  stopBtn.disabled = true;

  // Helpful status if on desktop (no sensors)
  if (!hasMotion || !hasOrientation) {
    console.warn("This device/browser may not have motion/orientation sensors.");
  }
});
