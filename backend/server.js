import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import analyzeRoute from "./routes/analyze.js";

dotenv.config();

const app = express();

// Allow requests from your frontend (replace with your Render frontend URL)
app.use(cors({ 
  origin: "https://tradex-te4p.onrender.com"
}));

app.use(express.json());

// Mount analyze route
app.use("/api", analyzeRoute);

// Optional: test route to make sure server is alive
app.get("/", (req, res) => res.send("OK"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});


