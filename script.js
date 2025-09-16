let watchId;
let tracking = false;
let path = [];
let map, polyline;

async function requestPermission() {
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      const r1 = await DeviceMotionEvent.requestPermission();
      const r2 = await DeviceOrientationEvent.requestPermission();
      if (r1 !== "granted" || r2 !== "granted") {
        alert("Sensor permission denied");
        return false;
      }
    } catch (e) {
      alert("Permission error: " + e);
      return false;
    }
  }
  return true;
}

async function initSensors() {
  const ok = await requestPermission();
  if (!ok) return;

  // Accelerometer
  window.addEventListener("devicemotion", (event) => {
    document.getElementById("ax").textContent = (event.acceleration.x || 0).toFixed(2);
    document.getElementById("ay").textContent = (event.acceleration.y || 0).toFixed(2);
    document.getElementById("az").textContent = (event.acceleration.z || 0).toFixed(2);
  });

  // Gyroscope
  window.addEventListener("deviceorientation", (event) => {
    document.getElementById("alpha").textContent = (event.alpha || 0).toFixed(2);
    document.getElementById("beta").textContent = (event.beta || 0).toFixed(2);
    document.getElementById("gamma").textContent = (event.gamma || 0).toFixed(2);
  });
}

// GPS + Run Tracking
function startRun
