import { useState, useCallback, useRef, useEffect } from "react";
import * as faceapi from "@vladmandic/face-api";

export interface EmotionResult {
  emotion: string;
  probability: number;
}

export interface FaceDetectionResult {
  emotions: EmotionResult[];
  dominantEmotion: string;
  confidence: number;
  faceDetected: boolean;
}

const MODEL_URL = "/models";

export const useFaceDetection = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const modelLoadedRef = useRef(false);

  const loadModels = useCallback(async () => {
    if (modelLoadedRef.current || isLoadingModel) {
      return isModelLoaded;
    }

    setIsLoadingModel(true);
    setModelError(null);

    try {
      // Load models from CDN since we don't have local models
      const CDN_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
      
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(CDN_URL),
      ]);

      modelLoadedRef.current = true;
      setIsModelLoaded(true);
      console.log("Face detection models loaded successfully");
      return true;
    } catch (error) {
      console.error("Failed to load face detection models:", error);
      setModelError("Nie udało się załadować modeli AI");
      return false;
    } finally {
      setIsLoadingModel(false);
    }
  }, [isLoadingModel, isModelLoaded]);

  const detectEmotions = useCallback(async (
    videoElement: HTMLVideoElement
  ): Promise<FaceDetectionResult | null> => {
    if (!modelLoadedRef.current) {
      console.warn("Models not loaded yet");
      return null;
    }

    try {
      // Try with looser threshold first - more permissive
      let detections = await faceapi
        .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.3,
        }))
        .withFaceExpressions();

      if (!detections) {
        console.log("[face-detection] no face on first try, retrying with smaller input");
        // Fallback with smaller input
        detections = await faceapi
          .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({
            inputSize: 160,
            scoreThreshold: 0.2,
          }))
          .withFaceExpressions();
      }

      if (!detections) {
        return {
          emotions: [],
          dominantEmotion: "neutral",
          confidence: 0,
          faceDetected: false,
        };
      }

      console.log("[face-detection] face detected, expressions:", detections.expressions);

      const expressions = detections.expressions;
      const emotions: EmotionResult[] = [
        { emotion: "happy", probability: expressions.happy },
        { emotion: "sad", probability: expressions.sad },
        { emotion: "angry", probability: expressions.angry },
        { emotion: "fearful", probability: expressions.fearful },
        { emotion: "disgusted", probability: expressions.disgusted },
        { emotion: "surprised", probability: expressions.surprised },
        { emotion: "neutral", probability: expressions.neutral },
      ].sort((a, b) => b.probability - a.probability);

      const dominant = emotions[0];

      return {
        emotions,
        dominantEmotion: dominant.emotion,
        confidence: Math.round(dominant.probability * 100),
        faceDetected: true,
      };
    } catch (error) {
      console.error("Face detection error:", error);
      return null;
    }
  }, []);

  // Perform multiple detections and average results
  const detectWithSampling = useCallback(async (
    videoElement: HTMLVideoElement,
    sampleCount: number = 5,
    intervalMs: number = 800
  ): Promise<FaceDetectionResult | null> => {
    const samples: FaceDetectionResult[] = [];

    for (let i = 0; i < sampleCount; i++) {
      const result = await detectEmotions(videoElement);
      if (result && result.faceDetected) {
        samples.push(result);
      }
      
      if (i < sampleCount - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    if (samples.length === 0) {
      return {
        emotions: [],
        dominantEmotion: "neutral",
        confidence: 50,
        faceDetected: false,
      };
    }

    // Aggregate emotions across all samples
    const emotionSums: Record<string, number> = {};
    const emotionCounts: Record<string, number> = {};

    samples.forEach(sample => {
      sample.emotions.forEach(e => {
        emotionSums[e.emotion] = (emotionSums[e.emotion] || 0) + e.probability;
        emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
      });
    });

    const avgEmotions: EmotionResult[] = Object.keys(emotionSums).map(emotion => ({
      emotion,
      probability: emotionSums[emotion] / emotionCounts[emotion],
    })).sort((a, b) => b.probability - a.probability);

    const dominant = avgEmotions[0];

    return {
      emotions: avgEmotions,
      dominantEmotion: dominant?.emotion || "neutral",
      confidence: Math.round((dominant?.probability || 0.5) * 100),
      faceDetected: true,
    };
  }, [detectEmotions]);

  return {
    isModelLoaded,
    isLoadingModel,
    modelError,
    loadModels,
    detectEmotions,
    detectWithSampling,
  };
};
