
import { GoogleGenAI, Type } from "@google/genai";
import { ScheduleEvent, User, DayOfWeek } from "../types";
import { DAYS, formatTime } from "../constants";

export const getSmartSuggestions = async (users: User[], events: ScheduleEvent[]) => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key missing. AI suggestions disabled.");
    return [];
  }

  // Strictly following the Google GenAI SDK rules
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const activeUsers = users.filter(u => u.active);
  const userMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u.name }), {} as Record<string, string>);
  
  const formattedEvents = events
    .filter(e => users.find(u => u.id === e.userId)?.active)
    .map(e => ({
      user: userMap[e.userId],
      day: DAYS[e.day],
      start: formatTime(e.startTime),
      end: formatTime(e.startTime + e.duration)
    }));

  const prompt = `
    Analyze the schedules of these people: ${activeUsers.map(u => u.name).join(', ')}.
    Existing busy times (Events): ${JSON.stringify(formattedEvents)}
    
    Task: Find 3-5 best available "Common Free Slots" for a group meeting or hangout (at least 60 mins long) during reasonable hours (9 AM - 10 PM).
    Be encouraging and provide specific reasons why these slots are good (e.g., "Right after Alice finishes work").
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.STRING },
                  time: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ['day', 'time', 'reason']
              }
            }
          },
          required: ['suggestions']
        }
      }
    });

    const jsonStr = response.text?.trim() || '{"suggestions": []}';
    return JSON.parse(jsonStr).suggestions;
  } catch (error) {
    console.error("AI Insight Error:", error);
    return [];
  }
};

export const parseScheduleImage = async (base64Image: string, mimeType: string) => {
  if (!process.env.API_KEY) {
    alert("AI features are not configured. Please add an API_KEY to environment variables.");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Extract all schedule events from this image.
    For each event, find:
    - title: the name of the class or meeting
    - day: 0 for Monday, 1 for Tuesday, ..., 6 for Sunday
    - startTime: number of minutes from 00:00 (e.g., 9:00 AM is 540)
    - duration: duration in minutes
    
    Return the data as a JSON array of events.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType
          }
        },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            events: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  day: { type: Type.INTEGER, description: "0=Mon, 6=Sun" },
                  startTime: { type: Type.INTEGER, description: "Minutes from midnight" },
                  duration: { type: Type.INTEGER, description: "Minutes long" }
                },
                required: ['title', 'day', 'startTime', 'duration']
              }
            }
          },
          required: ['events']
        }
      }
    });

    const jsonStr = response.text?.trim() || '{"events": []}';
    return JSON.parse(jsonStr).events;
  } catch (error) {
    console.error("AI Scan Error:", error);
    return [];
  }
};
