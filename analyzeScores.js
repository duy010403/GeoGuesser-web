const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.resolve(__dirname, "serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://geoguesser-84d8b-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

async function analyze() {
  const snapshot = await db.ref("guesses").once("value");
  const guesses = snapshot.val();
  const difficultyMap = {};

  // Gom nhóm theo tọa độ thật
  for (const id in guesses) {
    const { actualLat, actualLng, distance } = guesses[id];
    const key = `${actualLat.toFixed(5)}_${actualLng.toFixed(5)}`;

    if (!difficultyMap[key]) {
      difficultyMap[key] = { total: 0, count: 0 };
    }
    difficultyMap[key].total += distance;
    difficultyMap[key].count++;
  }

  // Gán độ khó
  const result = {};
  for (const key in difficultyMap) {
    const avg = difficultyMap[key].total / difficultyMap[key].count;
    let level = "easy";
    if (avg > 50) level = "hard";
    else if (avg > 10) level = "medium";
    result[key] = level;
  }

  await db.ref("difficultyLevels").set(result);
  console.log("Đã phân tích và lưu độ khó.");
}

analyze();
