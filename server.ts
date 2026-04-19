import express from "express";

import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });
  const PORT = Number(process.env.PORT) || 8080;

  // Analysis Logic
  function calculatePressure(data: any) {
    let pressure = 30.0;
    const runsNeeded = data.target - data.current_score;
    const oversLeft = 20.0 - data.overs_completed;
    const rrr = oversLeft > 0 ? runsNeeded / oversLeft : 0;
    
    if (rrr > 8) pressure += (rrr - 8) * 4;
    pressure += (data.wickets_lost * 8);
    
    if (!data.is_home_game) {
      pressure += (data.stadium_capacity / 10000) * 2.5;
    } else {
      pressure -= 5;
    }
    
    const score = Math.max(0, Math.min(100, Math.round(pressure * 100) / 100));

    let batterReaction = "";
    let bowlerReaction = "";

    if (score > 80) {
      batterReaction = `${data.current_batter} is looking visibly tense. Constant helmet adjustments indicate the massive crowd noise is penetrating his focus.`;
      bowlerReaction = `${data.current_bowler} is feeding off the energy. He's looking to strike while the batter is under extreme pressure.`;
    } else if (score > 60) {
      batterReaction = `${data.current_batter} is maintaining composure but the increased RRR is forcing some discomfort.`;
      bowlerReaction = `${data.current_bowler} is mixing up the pace well, sensing the batter's urgency.`;
    } else {
      batterReaction = `${data.current_batter} is in total control. The noise doesn't seem to affect his timing.`;
      bowlerReaction = `${data.current_bowler} is searching for rhythm. The batter has silenced the home support for now.`;
    }
    
    return {
      pressure_score: score,
      rrr: Math.round(rrr * 100) / 100,
      reactions: { batter: batterReaction, bowler: bowlerReaction }
    };
  }

  // Socket.io Chat Logic
  const messages: any[] = [];
  io.on("connection", (socket) => {
    socket.emit("message_history", messages);

    socket.on("send_message", (msg) => {
      const message = {
        id: Date.now().toString(),
        user: msg.user || "Anonymous",
        text: msg.text,
        timestamp: new Date().toISOString()
      };
      messages.push(message);
      if (messages.length > 50) messages.shift();
      io.emit("new_message", message);
    });
  });

  // API Routes
  app.post("/api/analyze", express.json(), (req, res) => {
    const matchData = req.body.match_info;
    if (!matchData) {
      return res.status(400).json({ error: "Missing match_info" });
    }

    const analyticsData = calculatePressure(matchData);
    
    res.json({
      match_info: matchData,
      analytics: {
        ...analyticsData,
        status: analyticsData.pressure_score > 80 ? "EXTREME PRESSURE" : analyticsData.pressure_score > 60 ? "HIGH PRESSURE" : "MODERATE PRESSURE",
        meter_color: analyticsData.pressure_score > 80 ? "#EF4444" : analyticsData.pressure_score > 60 ? "#F97316" : "#EAB308"
      },
      youtube_search: `https://www.youtube.com/results?search_query=${encodeURIComponent(matchData.current_batter + " handling pressure cricket")}`
    });
  });

  app.get("/api/live-match", (req, res) => {
    const matchData = {
      match: "RCB vs DC",
      batting_team: "DC",
      bowling_team: "RCB",
      stadium: "M. Chinnaswamy Stadium, Bengaluru",
      stadium_capacity: 32000,
      is_home_game: false,
      target: 176,
      current_score: 76,
      wickets_lost: 3,
      overs_completed: 9.0,
      current_batter: "KL Rahul",
      current_bowler: "Mohammed Siraj",
      weather: { temp: 32, humidity: 27, condition: "Clear Evening" }
    };

    const analyticsData = calculatePressure(matchData);
    
    res.json({
      match_info: matchData,
      analytics: {
        ...analyticsData,
        status: analyticsData.pressure_score > 80 ? "EXTREME PRESSURE" : analyticsData.pressure_score > 60 ? "HIGH PRESSURE" : "MODERATE PRESSURE",
        meter_color: analyticsData.pressure_score > 80 ? "#EF4444" : analyticsData.pressure_score > 60 ? "#F97316" : "#EAB308"
      },
      youtube_search: `https://www.youtube.com/results?search_query=${encodeURIComponent(matchData.current_batter + " handling pressure cricket")}`
    });
  });

  // Serve static files if needed in production
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}

startServer();
