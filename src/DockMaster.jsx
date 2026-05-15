import React, { useState, useEffect, useRef, useCallback, useMemo, Component } from 'react';

// === ERROR BOUNDARY ===
class GameErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    // Log error for debugging
    console.error('Game Error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0e',
          color: '#fff',
          textAlign: 'center',
          padding: 40,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ fontSize: 60, marginBottom: 20 }}>🚛💥</div>
          <h1 style={{ fontSize: 24, marginBottom: 10, color: '#ef4444' }}>
            Oops! Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 30, maxWidth: 'min(400px, calc(100vw - 40px))' }}>
            The game encountered an unexpected error. Don't worry, your progress is saved!
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '12px 30px',
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            🔄 Restart Game
          </button>
          {this.state.error && (
            <details style={{ marginTop: 30, textAlign: 'left', maxWidth: 500 }}>
              <summary style={{ cursor: 'pointer', color: '#6b7280' }}>Technical Details</summary>
              <pre style={{ 
                fontSize: 10, 
                color: '#ef4444', 
                backgroundColor: 'rgba(239,68,68,0.1)',
                padding: 15,
                borderRadius: 8,
                overflow: 'auto',
                maxHeight: 200
              }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }
    
    return this.props.children;
  }
}

// ============================================
// PREMIUM DOCK BACKING SIMULATOR
// Ultra-polished standalone game experience
// ============================================

const TRUCK_LENGTH = 130;
const TRUCK_WIDTH = 40;
const CAB_LENGTH = 35;
const WHEEL_WIDTH = 8;
const WHEEL_LENGTH = 14;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// === PHYSICS CONSTANTS ===
const PHYSICS = {
  // Base truck properties (26ft box truck)
  emptyWeight: 14000,      // lbs - empty truck
  maxLoadWeight: 10000,    // lbs - maximum cargo
  
  // Speed limits
  maxForwardSpeed: 120,
  maxReverseSpeed: 80,
  
  // Acceleration/Deceleration (affected by weight)
  baseAcceleration: 200,
  baseDeceleration: 120,
  brakeForce: 350,
  
  // Steering
  maxSteerAngle: Math.PI / 4,
  baseSteerSpeed: 4,
  
  // Friction coefficients
  dryAsphalt: 1.0,
  wetAsphalt: 0.7,
  ice: 0.3,
  gravel: 0.85,
  
  // Suspension
  suspensionStiffness: 0.15,
  suspensionDamping: 0.85,
  maxBodyRoll: 0.04,
  maxBodyPitch: 0.03,
  
  // Weight transfer
  weightTransferRate: 0.1,
  
  // Momentum/Inertia
  baseMomentum: 0.98,       // How much speed is retained per frame
  loadedMomentum: 0.985,    // Heavier = more momentum
};

// Premium color palette with industrial aesthetics
const THEME = {
  // Asphalt & Ground
  asphaltDark: '#0d0d0f',
  asphaltMid: '#1a1a1e',
  asphaltLight: '#252528',
  asphaltWear: '#2a2a2e',
  concrete: '#3d3d42',
  concreteLight: '#4a4a50',
  
  // Markings
  lineYellow: '#fbbf24',
  lineYellowGlow: 'rgba(251, 191, 36, 0.6)',
  lineWhite: '#e8e8ec',
  lineWhiteGlow: 'rgba(232, 232, 236, 0.4)',
  
  // Truck
  truckWhite: '#f5f5f7',
  truckShadow: '#d1d1d6',
  cabBlue: '#1e40af',
  cabBlueDark: '#1e3a8a',
  cabBlueHighlight: '#3b82f6',
  chrome: '#c0c0c8',
  chromeDark: '#808088',
  
  // Lights
  headlightCore: '#fffef0',
  headlightGlow: 'rgba(255, 254, 240, 0.9)',
  headlightBeam: 'rgba(255, 254, 240, 0.15)',
  brakeLightCore: '#ef4444',
  brakeLightGlow: 'rgba(239, 68, 68, 0.8)',
  brakeLightOuter: 'rgba(239, 68, 68, 0.3)',
  turnSignalAmber: '#f59e0b',
  turnSignalGlow: 'rgba(245, 158, 11, 0.7)',
  reverseLightCore: '#ffffff',
  reverseLightGlow: 'rgba(255, 255, 255, 0.6)',
  
  // Dock
  dockPlatform: '#374151',
  dockPlatformLight: '#4b5563',
  dockPlatformEdge: '#1f2937',
  rubberBumper: '#1a1a1e',
  rubberBumperStripe: '#fbbf24',
  dockLightRed: '#ef4444',
  dockLightGreen: '#22c55e',
  dockLightOff: '#374151',
  dockLightGlow: 'rgba(34, 197, 94, 0.6)',
  
  // Obstacles
  coneOrange: '#f97316',
  coneStripe: '#ffffff',
  carBody: '#64748b',
  carWindow: '#1e293b',
  dumpsterGreen: '#166534',
  trailerGray: '#6b7280',
  
  // Effects
  tireMarkLight: 'rgba(20, 20, 24, 0.3)',
  tireMarkDark: 'rgba(30, 30, 35, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.4)',
  shadowSoft: 'rgba(0, 0, 0, 0.2)',
  nightOverlay: 'rgba(8, 15, 25, 0.88)',
  successGlow: 'rgba(34, 197, 94, 0.4)',
  warningGlow: 'rgba(239, 68, 68, 0.4)',
  
  // UI
  uiBg: '#0a0a0c',
  uiCard: '#111114',
  uiCardHover: '#1a1a1e',
  uiBorder: '#2a2a30',
  uiText: '#f0f0f2',
  uiTextMuted: '#6b6b72',
  uiAccent: '#3b82f6',
  uiAccentGlow: 'rgba(59, 130, 246, 0.3)',
  uiSuccess: '#22c55e',
  uiWarning: '#f59e0b',
  uiDanger: '#ef4444',
  uiGold: '#fbbf24',
};

// CSS Animations (injected into document)
const UI_ANIMATIONS = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px currentColor; }
  50% { box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
}
@keyframes countdownPulse {
  0% { transform: scale(1.3); opacity: 0; }
  50% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 1; }
}
@keyframes confettiFall {
  0% { 
    opacity: 1;
    transform: translateY(0) rotate(0deg) scale(1);
  }
  100% { 
    opacity: 0;
    transform: translateY(100vh) rotate(720deg) scale(0.5);
  }
}
@keyframes failDebrisFall {
  0% { 
    opacity: 1;
    transform: translateY(0) rotate(0deg) scale(1);
  }
  40% {
    opacity: 0.8;
  }
  100% { 
    opacity: 0;
    transform: translateY(80vh) rotate(540deg) scale(0.3);
  }
}
@keyframes failShockwave {
  0% { 
    transform: scale(0);
    opacity: 0.6;
  }
  100% { 
    transform: scale(3);
    opacity: 0;
  }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes starPop {
  0% { transform: scale(0) rotate(-180deg); opacity: 0; }
  50% { transform: scale(1.3) rotate(10deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

/* Focus styles for accessibility */
button:focus-visible {
  outline: 2px solid #3b82f6 !important;
  outline-offset: 2px !important;
}
input:focus-visible, select:focus-visible {
  outline: 2px solid #3b82f6 !important;
  outline-offset: 1px !important;
}
a:focus-visible {
  outline: 2px solid #3b82f6 !important;
  outline-offset: 2px !important;
}
`;
// === ACCESSIBILITY SETTINGS ===
const ACCESSIBILITY_DEFAULTS = {
  reducedMotion: false,
  highContrast: false,
  colorBlindMode: 'none', // 'none', 'protanopia', 'deuteranopia', 'tritanopia'
  largeText: false,
  screenReaderMode: false,
  hapticFeedback: true,
  showControlHints: true,
  performanceMode: false, // Reduces visual effects for better performance on low-end devices
};

// Color blind friendly palettes
const COLOR_BLIND_PALETTES = {
  none: {
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    dock_aligned: '#22c55e',
    dock_misaligned: '#ef4444',
  },
  protanopia: { // Red-blind
    success: '#0ea5e9', // Blue instead of green
    warning: '#fbbf24', // Keep yellow
    danger: '#f97316', // Orange instead of red
    info: '#6366f1',
    dock_aligned: '#0ea5e9',
    dock_misaligned: '#f97316',
  },
  deuteranopia: { // Green-blind
    success: '#06b6d4', // Cyan instead of green
    warning: '#fbbf24',
    danger: '#f43f5e', // Pink-red
    info: '#8b5cf6',
    dock_aligned: '#06b6d4',
    dock_misaligned: '#f43f5e',
  },
  tritanopia: { // Blue-blind
    success: '#10b981', // Teal-green
    warning: '#fb923c', // Orange
    danger: '#ef4444',
    info: '#ec4899', // Pink instead of blue
    dock_aligned: '#10b981',
    dock_misaligned: '#ef4444',
  },
};

// High contrast color overrides
const HIGH_CONTRAST_COLORS = {
  uiBg: '#000000',
  uiCard: '#0a0a0a',
  uiCardHover: '#1a1a1a',
  uiBorder: '#ffffff',
  uiText: '#ffffff',
  uiTextMuted: '#cccccc',
  uiAccent: '#00ff00',
  uiSuccess: '#00ff00',
  uiWarning: '#ffff00',
  uiDanger: '#ff0000',
};

// Stub constants for minigame (full progression system removed)
const XP_LEVELS = [
  { level: 1, name: 'Driver', xpRequired: 0, icon: '🚚' },
];

// Level configurations
// Par system for each level (target time in seconds, target pull-ups)
const LEVEL_PARS = {
  1: { time: 30, pullUps: 1, description: 'Straightforward approach' },
  2: { time: 35, pullUps: 2, description: 'One adjustment expected' },
  3: { time: 40, pullUps: 2, description: 'Tight squeeze requires patience' },
  4: { time: 45, pullUps: 3, description: 'Blind side is tricky' },
  5: { time: 50, pullUps: 2, description: 'Limited visibility adds time' },
  6: { time: 40, pullUps: 2, description: 'Navigate the chaos' },
  7: { time: 50, pullUps: 3, description: 'Alley requires multiple adjustments' },
  8: { time: 35, pullUps: 1, description: 'Race pace required' },
};

// Maximum pull-ups allowed per level before failure (par + 3)
const getMaxPullUps = (level) => {
  const par = LEVEL_PARS[level];
  if (!par) return 8; // Generous default for endless/unknown levels
  return par.pullUps + 3;
};

// Skill tips for each level
const LEVEL_TIPS = {
  1: [
    "Keep your steering wheel straight and use small corrections",
    "Watch your mirrors - the trailer follows the cab's path",
    "Go slow at first - you can always speed up later"
  ],
  2: [
    "Start by turning toward the dock to set your angle",
    "The trailer will swing opposite to your steering",
    "Straighten out once your rear is lined up with the dock"
  ],
  3: [
    "Use the trailer endpoints of the adjacent trucks as guides",
    "Keep equal distance on both sides",
    "Small steering inputs prevent overcorrection"
  ],
  4: [
    "Blind side backing requires extra mirror checks",
    "Turn your head to check the passenger side",
    "Go extra slow - visibility is limited on this side"
  ],
  5: [
    "In night mode, rely more on your mirrors",
    "The dock lights indicate your alignment",
    "Use the headlight reflections on the ground"
  ],
  6: [
    "Scan for moving obstacles before committing",
    "Plan your path around static obstacles first",
    "Be ready to stop if pedestrians approach"
  ],
  7: [
    "The alley requires a three-point approach",
    "Pull forward to gain angle, then back in",
    "Multiple pull-ups are expected on this level"
  ],
  8: [
    "Speed matters but precision is king",
    "Practice the approach angle before racing",
    "Smooth inputs are faster than jerky corrections"
  ]
};

// Calculate stars based on score
const calculateStars = (score) => {
  if (score >= 95) return 3;
  if (score >= 80) return 2;
  if (score >= 60) return 1;
  return 0;
};

// Calculate XP earned from a level completion
const calculateXPEarned = (level, score, time, pullUps, collisions, isFirstCompletion, attempts = 1) => {
  let xp = 0;
  
  // Base XP for completion
  xp += 25 + (level * 10);
  
  // Star bonuses
  const stars = calculateStars(score);
  xp += stars * 15;
  
  // First completion bonus
  if (isFirstCompletion) xp += 50;
  
  // Perfect bonuses
  if (collisions === 0) xp += 20;
  if (pullUps === 0) xp += 15;
  
  // Par bonuses
  const par = LEVEL_PARS[level];
  if (par) {
    if (time && time < par.time) xp += 25;
    if (pullUps <= par.pullUps) xp += 15;
  }
  
  // Score bonus (1 XP per point over 70)
  if (score > 70) xp += Math.floor((score - 70) * 0.5);
  
  // Apply attempt penalty multiplier
  const attemptMultiplier = getAttemptMultiplier(attempts);
  xp = Math.round(xp * attemptMultiplier);
  
  return xp;
};

// Get player level from XP
const getPlayerLevel = (xp) => {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].xpRequired) {
      return XP_LEVELS[i];
    }
  }
  return XP_LEVELS[0];
};

// Get progress to next level (0-1)
const getLevelProgress = (xp) => {
  const currentLevel = getPlayerLevel(xp);
  const currentIndex = XP_LEVELS.findIndex(l => l.level === currentLevel.level);
  
  if (currentIndex >= XP_LEVELS.length - 1) return 1; // Max level
  
  const nextLevel = XP_LEVELS[currentIndex + 1];
  const xpIntoLevel = xp - currentLevel.xpRequired;
  const xpNeeded = nextLevel.xpRequired - currentLevel.xpRequired;
  
  return xpIntoLevel / xpNeeded;
};

const LEVEL_CONFIGS = {
  1: {
    name: "ORIENTATION",
    subtitle: "Straight Line Backing",
    difficulty: "ROOKIE",
    timeLimit: null,
    targetScore: 80,
    truckStart: { x: 400, y: 480, angle: Math.PI / 2 },
    dock: { x: 400, y: 90, width: 62, angle: 0 },
    obstacles: [],
    guidelines: true,
    nightMode: false,
    environment: 'warehouse',
    weather: 'clear',
    loadWeight: 0,
    description: "Master the basics. Back straight into the loading dock."
  },
  2: {
    name: "OFFSET ENTRY",
    subtitle: "45° Approach Angle",
    difficulty: "ROOKIE",
    timeLimit: 90,
    targetScore: 75,
    truckStart: { x: 180, y: 480, angle: Math.PI / 6 },
    dock: { x: 400, y: 90, width: 60, angle: 0 },
    obstacles: [
      { type: 'cone', x: 280, y: 300 },
      { type: 'cone', x: 520, y: 300 },
    ],
    guidelines: true,
    nightMode: false,
    environment: 'retail',
    weather: 'clear',
    loadWeight: 2000,
    description: "Approach at an angle. Swing wide, then straighten."
  },
  3: {
    name: "THE SQUEEZE",
    subtitle: "Between Trailers",
    difficulty: "STANDARD",
    timeLimit: 75,
    targetScore: 75,
    truckStart: { x: 580, y: 440, angle: -Math.PI / 4 },
    dock: { x: 400, y: 90, width: 56, angle: 0 },
    obstacles: [
      { type: 'trailer', x: 260, y: 160, width: 130, height: 48, angle: 0 },
      { type: 'trailer', x: 540, y: 160, width: 130, height: 48, angle: 0 },
    ],
    guidelines: false,
    nightMode: false,
    environment: 'port',
    weather: 'clear',
    loadWeight: 4000,
    description: "Navigate between parked trailers. Inches matter."
  },
  4: {
    name: "BLIND SIDE",
    subtitle: "Passenger Side Backing",
    difficulty: "STANDARD",
    timeLimit: 60,
    targetScore: 70,
    truckStart: { x: 180, y: 400, angle: 0 },
    dock: { x: 700, y: 300, width: 56, angle: Math.PI },
    obstacles: [
      { type: 'dumpster', x: 400, y: 200, width: 65, height: 45 },
      { type: 'bollard', x: 550, y: 350 },
      { type: 'bollard', x: 550, y: 250 },
    ],
    guidelines: false,
    nightMode: false,
    environment: 'construction',
    weather: 'clear',
    blindSide: true,
    loadWeight: 5000,
    description: "Back to your blind side. Trust your mirrors."
  },
  5: {
    name: "NIGHT SHIFT",
    subtitle: "Limited Visibility",
    difficulty: "STANDARD",
    timeLimit: 90,
    targetScore: 70,
    truckStart: { x: 200, y: 480, angle: Math.PI / 4 },
    dock: { x: 400, y: 90, width: 56, angle: 0 },
    obstacles: [
      { type: 'trailer', x: 260, y: 160, width: 130, height: 48, angle: 0 },
      { type: 'trailer', x: 540, y: 160, width: 130, height: 48, angle: 0 },
      { type: 'pallet', x: 400, y: 250, width: 40, height: 48 },
      { type: 'pedestrian_zone', x: 150, y: 300, width: 70, height: 50 },
    ],
    movingObstacles: [
      { type: 'moving_truck', startX: 700, startY: 350, endX: 100, endY: 350, speed: 20, width: 100, height: 40, color: '#4b5563' },
    ],
    guidelines: false,
    nightMode: true,
    environment: 'airport',
    weather: 'clear',
    loadWeight: 6000,
    description: "Darkness falls. Headlights are your only guide."
  },
  6: {
    name: "CHAOS ZONE",
    subtitle: "Active Loading Area",
    difficulty: "PRO",
    timeLimit: 60,
    targetScore: 70,
    truckStart: { x: 140, y: 480, angle: Math.PI / 8 },
    dock: { x: 620, y: 110, width: 56, angle: -Math.PI / 4 },
    obstacles: [
      { type: 'car', x: 300, y: 360, width: 48, height: 26, angle: Math.PI / 12 },
      { type: 'car', x: 460, y: 280, width: 48, height: 26, angle: -Math.PI / 8 },
      { type: 'cart', x: 380, y: 200, width: 22, height: 16 },
      { type: 'cart', x: 560, y: 260, width: 22, height: 16 },
      { type: 'pallet', x: 240, y: 220, width: 40, height: 48 },
      { type: 'pallet', x: 520, y: 380, width: 40, height: 48 },
      { type: 'barrel', x: 180, y: 320, width: 24 },
      { type: 'barrel', x: 200, y: 300, width: 24 },
      { type: 'oilslick', x: 350, y: 420, width: 55, height: 35 },
    ],
    movingObstacles: [
      { type: 'pedestrian', startX: 200, startY: 250, endX: 520, endY: 250, speed: 35 },
      { type: 'forklift', startX: 150, startY: 180, endX: 450, endY: 180, speed: 25, width: 35, height: 55 },
    ],
    guidelines: false,
    nightMode: false,
    environment: 'warehouse',
    weather: 'clear',
    honkAfter: 30,
    loadWeight: 7000,
    description: "Active warehouse. Watch for workers and equipment."
  },
  7: {
    name: "THE ALLEY",
    subtitle: "Narrow Passage",
    difficulty: "PRO",
    timeLimit: 75,
    targetScore: 70,
    truckStart: { x: 400, y: 540, angle: Math.PI },
    dock: { x: 400, y: 90, width: 54, angle: 0 },
    obstacles: [
      { type: 'wall', x: 320, y: 300, width: 20, height: 280 },
      { type: 'wall', x: 480, y: 300, width: 20, height: 280 },
      { type: 'dumpster', x: 350, y: 420, width: 40, height: 35, angle: Math.PI / 16 },
      { type: 'bollard', x: 360, y: 200 },
      { type: 'bollard', x: 440, y: 200 },
      { type: 'puddle', x: 400, y: 350, width: 50, height: 35 },
      { type: 'puddle', x: 380, y: 480, width: 45, height: 30 },
    ],
    guidelines: false,
    nightMode: true,
    environment: 'cold_storage',
    weather: 'snow',
    loadWeight: 8000,
    description: "A freezing alley at night. Ice and no room for error."
  },
  8: {
    name: "DOUBLE DOCK",
    subtitle: "Race The Competition",
    difficulty: "ELITE",
    timeLimit: 50,
    targetScore: 75,
    truckStart: { x: 200, y: 500, angle: Math.PI / 8 },
    dock: { x: 300, y: 90, width: 54, angle: 0 },
    obstacles: [
      { type: 'cone', x: 400, y: 350 },
      { type: 'cone', x: 400, y: 250 },
      { type: 'spilledcargo', x: 350, y: 420, width: 65, height: 45 },
      { type: 'oilslick', x: 480, y: 380, width: 50, height: 35 },
      { type: 'barrel', x: 550, y: 300, width: 24 },
    ],
    aiTruck: {
      startX: 600,
      startY: 500,
      startAngle: -Math.PI / 8,
      targetX: 500,
      targetY: 120,
      color: '#dc2626'
    },
    guidelines: false,
    nightMode: false,
    environment: 'port',
    weather: 'snow',
    loadWeight: 9000,
    description: "Winter port. Beat the competition to the dock."
  }
};

// === GAME MODES ===
const GAME_MODES = {
  standard: {
    id: 'standard',
    name: 'STANDARD',
    description: 'Complete all 8 levels with your best score',
    icon: '🎮',
    unlocked: true,
  },
  time_attack: {
    id: 'time_attack',
    name: 'TIME ATTACK',
    description: 'Race against the clock - 15 seconds per dock!',
    icon: '⏱️',
    unlocked: true,
    modifiers: {
      timeLimit: 15,
      noCollisionPenalty: true,
      bonusTimePerDock: 5,
    }
  },
};

const ENVIRONMENTS = {
  warehouse: {
    id: 'warehouse',
    name: 'Industrial Warehouse',
    icon: '🏭',
    ground: {
      primary: '#1a1a1e',
      secondary: '#252528',
      accent: '#2a2a2e',
      lines: '#3d3d42'
    },
    ambient: {
      color: 'rgba(200, 180, 160, 0.03)',
      particles: ['dust', 'steam'],
    },
    obstacles: ['forklift', 'pallet', 'barrel', 'crate'],
    sounds: ['warehouse_ambience', 'forklift_beep'],
  },
  port: {
    id: 'port',
    name: 'Shipping Port',
    icon: '🚢',
    ground: {
      primary: '#1e2228',
      secondary: '#282d33',
      accent: '#323840',
      lines: '#4a5058'
    },
    ambient: {
      color: 'rgba(100, 150, 200, 0.05)',
      particles: ['seagull', 'salt_spray'],
    },
    obstacles: ['container', 'crane_base', 'anchor', 'rope_coil'],
    sounds: ['seagulls', 'ship_horn', 'waves'],
    weather: ['fog', 'wind'],
  },
  retail: {
    id: 'retail',
    name: 'Retail Loading',
    icon: '🏪',
    ground: {
      primary: '#1f1f22',
      secondary: '#28282c',
      accent: '#323236',
      lines: '#45454a'
    },
    ambient: {
      color: 'rgba(255, 200, 100, 0.04)',
      particles: ['shopping_cart'],
    },
    obstacles: ['shopping_cart', 'pallet_jack', 'cardboard'],
    sounds: ['retail_ambience', 'cart_rattle'],
  },
  airport: {
    id: 'airport',
    name: 'Airport Cargo',
    icon: '✈️',
    ground: {
      primary: '#1c1e22',
      secondary: '#24272c',
      accent: '#2e3238',
      lines: '#50555c'
    },
    ambient: {
      color: 'rgba(150, 180, 220, 0.04)',
      particles: ['jet_exhaust'],
    },
    obstacles: ['luggage_cart', 'fuel_truck', 'cone', 'ground_equipment'],
    sounds: ['jet_engine_distant', 'radio_chatter'],
    hasRunwayLights: true,
  },
  cold_storage: {
    id: 'cold_storage',
    name: 'Cold Storage',
    icon: '❄️',
    ground: {
      primary: '#1a1d22',
      secondary: '#22262c',
      accent: '#2a3038',
      lines: '#404850'
    },
    ambient: {
      color: 'rgba(180, 220, 255, 0.06)',
      particles: ['frost', 'breath'],
    },
    obstacles: ['freezer_unit', 'ice_buildup', 'insulated_pallet'],
    sounds: ['freezer_hum', 'ice_crackle'],
    frostyWindshield: true,
    slipperyGround: true,
  },
  construction: {
    id: 'construction',
    name: 'Construction Site',
    icon: '🚧',
    ground: {
      primary: '#2a2418',
      secondary: '#342e20',
      accent: '#3e3828',
      lines: '#5a5040'
    },
    ambient: {
      color: 'rgba(200, 150, 80, 0.05)',
      particles: ['dust_cloud', 'debris'],
    },
    obstacles: ['barrier', 'excavator', 'dirt_pile', 'rebar'],
    sounds: ['construction_ambience', 'backup_beeper'],
    dusty: true,
  },
};

// Weather system configurations
// Weather configurations
const WEATHER_TYPES = {
  clear: {
    id: 'clear',
    name: 'Clear',
    friction: 1.0,
  },
  snow: {
    id: 'snow',
    name: 'Snow',
    friction: 0.4,
  },
};

// Time of day configurations
const TIME_OF_DAY = {
  dawn: {
    id: 'dawn',
    name: 'Dawn',
    skyColor: 'linear-gradient(180deg, #2c1810 0%, #8a4a2a 50%, #c9a080 100%)',
    ambientLight: 0.5,
    shadowLength: 3,
    shadowAngle: -0.3,
    tint: 'rgba(255, 180, 120, 0.08)',
  },
  morning: {
    id: 'morning',
    name: 'Morning',
    skyColor: 'linear-gradient(180deg, #4a6fa5 0%, #88b4d0 100%)',
    ambientLight: 0.85,
    shadowLength: 1.5,
    shadowAngle: -0.5,
    tint: 'rgba(255, 250, 230, 0.03)',
  },
  noon: {
    id: 'noon',
    name: 'Noon',
    skyColor: 'linear-gradient(180deg, #5588bb 0%, #99ccee 100%)',
    ambientLight: 1.0,
    shadowLength: 0.3,
    shadowAngle: 0,
    tint: null,
  },
  afternoon: {
    id: 'afternoon',
    name: 'Afternoon',
    skyColor: 'linear-gradient(180deg, #5a7a9a 0%, #a0c0d8 100%)',
    ambientLight: 0.9,
    shadowLength: 1.2,
    shadowAngle: 0.4,
    tint: 'rgba(255, 220, 180, 0.04)',
  },
  dusk: {
    id: 'dusk',
    name: 'Dusk',
    skyColor: 'linear-gradient(180deg, #1a1525 0%, #6a3050 50%, #d06840 100%)',
    ambientLight: 0.4,
    shadowLength: 4,
    shadowAngle: 0.6,
    tint: 'rgba(255, 120, 80, 0.1)',
  },
  night: {
    id: 'night',
    name: 'Night',
    skyColor: 'linear-gradient(180deg, #0a0a12 0%, #151520 100%)',
    ambientLight: 0.15,
    shadowLength: 0,
    shadowAngle: 0,
    tint: 'rgba(30, 50, 80, 0.2)',
    needsHeadlights: true,
  },
};

// Dynamic obstacle definitions
const DYNAMIC_OBSTACLES = {
  forklift: {
    type: 'forklift',
    width: 45,
    height: 28,
    color: '#f59e0b',
    movable: true,
    moveSpeed: 25,
    movePattern: 'patrol',
  },
  pedestrian: {
    type: 'pedestrian',
    width: 12,
    height: 12,
    color: '#3b82f6',
    movable: true,
    moveSpeed: 40,
    movePattern: 'wander',
    avoidsPlayer: true,
  },
  shopping_cart: {
    type: 'shopping_cart',
    width: 18,
    height: 14,
    color: '#94a3b8',
    pushable: true,
    friction: 0.3,
  },
  bird: {
    type: 'bird',
    width: 8,
    height: 6,
    color: '#475569',
    movable: true,
    moveSpeed: 80,
    movePattern: 'fly',
    fleesOnApproach: true,
  },
};

// === TRUCK CUSTOMIZATION ===
const TRUCK_COLORS = {
  // Standard colors (unlocked by default)
  white: { id: 'white', name: 'Classic White', primary: '#f8f8fa', secondary: '#e4e4e7', unlocked: true },
  blue: { id: 'blue', name: 'Ocean Blue', primary: '#3b82f6', secondary: '#2563eb', unlocked: true },
  red: { id: 'red', name: 'Fire Red', primary: '#ef4444', secondary: '#dc2626', unlocked: true },
  
  // Ghost color (internal use)
  cyan: { id: 'cyan', name: 'Ghost Cyan', primary: '#06b6d4', secondary: '#0891b2', unlocked: false, hidden: true },
  
  // Unlockable colors
  green: { id: 'green', name: 'Forest Green', primary: '#22c55e', secondary: '#16a34a', unlockCondition: 'Complete 5 levels', xpCost: 500 },
  yellow: { id: 'yellow', name: 'Taxi Yellow', primary: '#eab308', secondary: '#ca8a04', unlockCondition: 'Complete 10 docks', xpCost: 300 },
  orange: { id: 'orange', name: 'Safety Orange', primary: '#f97316', secondary: '#ea580c', unlockCondition: 'First perfect dock', xpCost: 400 },
  purple: { id: 'purple', name: 'Royal Purple', primary: '#a855f7', secondary: '#9333ea', unlockCondition: 'Reach Level 5', xpCost: 800 },
  black: { id: 'black', name: 'Midnight Black', primary: '#1f2937', secondary: '#111827', unlockCondition: '3 night levels', xpCost: 600 },
  pink: { id: 'pink', name: 'Hot Pink', primary: '#ec4899', secondary: '#db2777', unlockCondition: 'Complete all levels', xpCost: 1000 },
  gold: { id: 'gold', name: 'Championship Gold', primary: '#fbbf24', secondary: '#f59e0b', unlockCondition: 'All 3-star levels', xpCost: 2000 },
  chrome: { id: 'chrome', name: 'Chrome', primary: '#cbd5e1', secondary: '#94a3b8', gradient: true, unlockCondition: 'Reach max level', xpCost: 5000 },
  
  // NEW COLORS - Batch 10
  teal: { id: 'teal', name: 'Teal Wave', primary: '#14b8a6', secondary: '#0d9488', unlockCondition: 'Complete 20 docks', xpCost: 450 },
  navy: { id: 'navy', name: 'Navy Blue', primary: '#1e3a8a', secondary: '#1e40af', unlockCondition: 'Complete 15 docks', xpCost: 700 },
  bronze: { id: 'bronze', name: 'Bronze Medal', primary: '#cd7f32', secondary: '#a0522d', unlockCondition: '50 successful docks', xpCost: 900 },
  silver: { id: 'silver', name: 'Silver Streak', primary: '#9ca3af', secondary: '#6b7280', gradient: true, unlockCondition: '25 perfect docks', xpCost: 1500 },
  emerald: { id: 'emerald', name: 'Emerald Dream', primary: '#059669', secondary: '#047857', unlockCondition: 'Beat all par times', xpCost: 1200 },
};

const CAB_STYLES = {
  standard: { id: 'standard', name: 'Standard Cab', unlocked: true },
  sleeper: { id: 'sleeper', name: 'Sleeper Cab', cabExtension: 15, unlockCondition: '20 successful docks', xpCost: 400 },
  aerodynamic: { id: 'aerodynamic', name: 'Aero Cab', roofFairing: true, unlockCondition: 'Beat all par times', xpCost: 600 },
};

const BOX_STYLES = {
  plain: { id: 'plain', name: 'Plain Box', unlocked: true },
  ribbed: { id: 'ribbed', name: 'Ribbed Panels', ribs: 8, unlocked: true },
  smooth: { id: 'smooth', name: 'Smooth Finish', unlockCondition: '10 perfect docks', xpCost: 500 },
  refrigerated: { id: 'refrigerated', name: 'Reefer Unit', hasReefer: true, unlockCondition: 'Cold storage level', xpCost: 700 },
};

const DECALS = {
  none: { id: 'none', name: 'No Decal', unlocked: true },
  flames: { id: 'flames', name: 'Flames', pattern: 'flames', color: '#f97316', unlocked: true },
  stripes: { id: 'stripes', name: 'Racing Stripes', pattern: 'stripes', color: '#3b82f6', unlocked: true },
  checkered: { id: 'checkered', name: 'Checkered', pattern: 'checkered', unlocked: true },
};

const ACCESSORIES = {
  none: { id: 'none', name: 'No Accessories', type: 'none', unlocked: true },
  lightbar: { id: 'lightbar', name: 'LED Light Bar', type: 'roof', functional: true, unlocked: true },
  mudflaps: { id: 'mudflaps', name: 'Mud Flaps', type: 'rear', unlocked: true },
};

// Audio Engine with enhanced sounds
class PremiumAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
    
    // === AUDIO MIX LEVELS (normalized 0-1) ===
    this.mix = {
      master: 0.5,          // Overall volume
      engine: 0.25,         // Engine sounds
      collision: 0.35,      // Impact sounds
      ui: 0.3,              // UI sounds (beeps, jingles)
      ambience: 0.15,       // Background ambience
      music: 0.12,          // Background music
      spotter: 0.4,         // Spotter voice
      proximity: 0.08,      // Proximity warning beeps
      reverseBeep: 0.1,     // Reverse beeping
    };
    
    // Engine system
    this.engineLayers = null;
    this.engineRunning = false;
    this.currentRPM = 800; // Idle RPM
    this.targetRPM = 800;
    
    // Turbo system
    this.turboOsc = null;
    this.turboGain = null;
    this.turboSpoolUp = 0;
    
    // Ambience
    this.ambienceActive = false;
    this.rainActive = false;
    this.rainSources = [];
    
    // Background music
    this.musicPlaying = false;
    this.musicGain = null;
    this.musicOscillators = [];
    this.musicVolume = 0.3;
    
    // Spotter system
    this.spotterTimeout = null;
    this.lastSpotterPhrase = '';
    
    // Alignment beep system
    this.alignmentBeepInterval = null;
    this.lastAlignmentBeep = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Audio not supported');
    }
  }

  // Haptic feedback helper
  vibrate(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  // === MULTI-LAYER DIESEL ENGINE ===
  startEngine() {
    if (!this.ctx || this.engineRunning) return;
    this.engineRunning = true;
    
    // Create engine bus
    this.engineBus = this.ctx.createGain();
    this.engineBus.gain.value = 0.15;
    this.engineBus.connect(this.masterGain);
    
    // Layer 1: Deep rumble (25-40Hz)
    const rumble = this.ctx.createOscillator();
    const rumbleGain = this.ctx.createGain();
    const rumbleFilter = this.ctx.createBiquadFilter();
    rumble.type = 'sawtooth';
    rumble.frequency.value = 28;
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 80;
    rumbleGain.gain.value = 0.4;
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.engineBus);
    rumble.start();
    
    // Layer 2: Mid combustion chug (55-80Hz)
    const chug = this.ctx.createOscillator();
    const chugGain = this.ctx.createGain();
    chug.type = 'square';
    chug.frequency.value = 55;
    chugGain.gain.value = 0.2;
    chug.connect(chugGain);
    chugGain.connect(this.engineBus);
    chug.start();
    
    // Layer 3: High mechanical whine (150-300Hz)
    const whine = this.ctx.createOscillator();
    const whineGain = this.ctx.createGain();
    const whineFilter = this.ctx.createBiquadFilter();
    whine.type = 'sawtooth';
    whine.frequency.value = 180;
    whineFilter.type = 'bandpass';
    whineFilter.frequency.value = 200;
    whineFilter.Q.value = 2;
    whineGain.gain.value = 0.08;
    whine.connect(whineFilter);
    whineFilter.connect(whineGain);
    whineGain.connect(this.engineBus);
    whine.start();
    
    // Layer 4: Combustion noise (filtered noise)
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = this.ctx.createBiquadFilter();
    const noiseGain = this.ctx.createGain();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 100;
    noiseFilter.Q.value = 1;
    noiseGain.gain.value = 0.05;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.engineBus);
    noise.start();
    
    this.engineLayers = {
      rumble: { osc: rumble, gain: rumbleGain, baseFreq: 28 },
      chug: { osc: chug, gain: chugGain, baseFreq: 55 },
      whine: { osc: whine, gain: whineGain, baseFreq: 180 },
      noise: { source: noise, gain: noiseGain, filter: noiseFilter }
    };
    
    // Start turbo system
    this.initTurbo();
  }

  stopEngine() {
    if (!this.engineRunning || !this.engineLayers) return;
    
    try {
      this.engineLayers.rumble.osc.stop();
      this.engineLayers.chug.osc.stop();
      this.engineLayers.whine.osc.stop();
      this.engineLayers.noise.source.stop();
      if (this.turboOsc) this.turboOsc.stop();
    } catch (e) {}
    
    this.engineLayers = null;
    this.turboOsc = null;
    this.engineRunning = false;
  }

  // Update engine based on speed/throttle
  updateEngine(speed, throttle, braking) {
    if (!this.engineLayers || !this.ctx) return;
    
    // Calculate target RPM based on speed and throttle
    const absSpeed = Math.abs(speed);
    const baseRPM = 800; // Idle
    const maxRPM = 2800;
    
    if (braking) {
      this.targetRPM = baseRPM + absSpeed * 8;
    } else if (Math.abs(throttle) > 0.1) {
      this.targetRPM = baseRPM + absSpeed * 15 + Math.abs(throttle) * 600;
    } else {
      this.targetRPM = baseRPM + absSpeed * 5;
    }
    this.targetRPM = Math.min(maxRPM, Math.max(baseRPM, this.targetRPM));
    
    // Smooth RPM transition
    this.currentRPM += (this.targetRPM - this.currentRPM) * 0.1;
    
    // Update frequencies based on RPM
    const rpmFactor = this.currentRPM / baseRPM;
    
    this.engineLayers.rumble.osc.frequency.setTargetAtTime(
      this.engineLayers.rumble.baseFreq * rpmFactor, this.ctx.currentTime, 0.1
    );
    this.engineLayers.chug.osc.frequency.setTargetAtTime(
      this.engineLayers.chug.baseFreq * rpmFactor, this.ctx.currentTime, 0.1
    );
    this.engineLayers.whine.osc.frequency.setTargetAtTime(
      this.engineLayers.whine.baseFreq * rpmFactor, this.ctx.currentTime, 0.1
    );
    
    // Adjust volumes based on load
    const loadFactor = Math.abs(throttle) > 0.1 ? 1.2 : 0.8;
    this.engineBus.gain.setTargetAtTime(0.15 * loadFactor, this.ctx.currentTime, 0.1);
    
    // Update turbo
    this.updateTurbo(throttle, this.currentRPM);
  }

  // === TURBO SYSTEM ===
  initTurbo() {
    if (!this.ctx) return;
    
    this.turboOsc = this.ctx.createOscillator();
    this.turboGain = this.ctx.createGain();
    const turboFilter = this.ctx.createBiquadFilter();
    
    this.turboOsc.type = 'sine';
    this.turboOsc.frequency.value = 800;
    turboFilter.type = 'highpass';
    turboFilter.frequency.value = 600;
    this.turboGain.gain.value = 0;
    
    this.turboOsc.connect(turboFilter);
    turboFilter.connect(this.turboGain);
    this.turboGain.connect(this.engineBus);
    this.turboOsc.start();
  }

  updateTurbo(throttle, rpm) {
    if (!this.turboOsc || !this.turboGain || !this.ctx) return;
    
    // Turbo spools up with throttle and RPM
    const targetSpool = throttle > 0.3 && rpm > 1200 ? Math.min(1, (rpm - 1200) / 1000) : 0;
    this.turboSpoolUp += (targetSpool - this.turboSpoolUp) * 0.05;
    
    // Turbo whistle frequency increases with spool
    const turboFreq = 800 + this.turboSpoolUp * 2500;
    this.turboOsc.frequency.setTargetAtTime(turboFreq, this.ctx.currentTime, 0.1);
    this.turboGain.gain.setTargetAtTime(this.turboSpoolUp * 0.06, this.ctx.currentTime, 0.1);
  }

  // === JAKE BRAKE ===
  playJakeBrake(intensity = 1) {
    if (!this.ctx) return;
    
    // Characteristic brapping sound of engine brake
    const duration = 0.4;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    osc1.type = 'sawtooth';
    osc1.frequency.value = 45;
    osc2.type = 'square';
    osc2.frequency.value = 90;
    
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    
    gain.gain.setValueAtTime(0.2 * intensity, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + duration);
    osc2.stop(this.ctx.currentTime + duration);
    
    // Add characteristic pops
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.playExhaustPop(0.3), i * 80);
    }
  }

  // === EXHAUST POP ===
  playExhaustPop(intensity = 0.5) {
    if (!this.ctx) return;
    
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.08, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 50) * intensity;
    }
    
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    gain.gain.value = 0.3;
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  // === SPOTTER VOICE SYSTEM ===
  playSpotterVoice(phrase) {
    if (!this.ctx || phrase === this.lastSpotterPhrase) return;
    this.lastSpotterPhrase = phrase;
    
    // Clear any pending spotter
    if (this.spotterTimeout) clearTimeout(this.spotterTimeout);
    
    // Synthesized voice-like sounds for success
    const phrases = {
      'perfect': { notes: [400, 500, 600, 500], durations: [0.1, 0.1, 0.15, 0.2] },
      'good_job': { notes: [380, 450, 500], durations: [0.12, 0.12, 0.25] },
    };
    
    const p = phrases[phrase];
    if (!p) return;
    
    let time = 0;
    p.notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        // Vocal formant simulation
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        filter.type = 'bandpass';
        filter.frequency.value = freq * 2;
        filter.Q.value = 5;
        
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + p.durations[i]);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + p.durations[i]);
      }, time * 1000);
      time += p.durations[i] * 0.8;
    });
    
    // Reset last phrase after a delay
    this.spotterTimeout = setTimeout(() => {
      this.lastSpotterPhrase = '';
    }, 2000);
  }

  // === ALIGNMENT BEEPS ===
  playAlignmentBeep(alignment) {
    if (!this.ctx) return;
    
    // Beep frequency based on alignment (0-1, 1 = perfect)
    const now = Date.now();
    const beepInterval = 800 - alignment * 600; // 800ms when far, 200ms when close
    
    if (now - this.lastAlignmentBeep < beepInterval) return;
    this.lastAlignmentBeep = now;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Higher pitch when more aligned
    const freq = 600 + alignment * 800;
    
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
    
    // Haptic pulse
    if (alignment > 0.8) {
      this.vibrate(20);
    }
  }
  
  // === STAR SOUNDS ===
  playStarEarned(starNumber) {
    if (!this.ctx) return;
    
    // Increasingly triumphant sounds for 1, 2, 3 stars
    const starSounds = {
      1: [523, 659], // C5, E5
      2: [523, 659, 784], // C5, E5, G5
      3: [523, 659, 784, 1047, 1319], // C5, E5, G5, C6, E6
    };
    
    const notes = starSounds[starNumber] || starSounds[1];
    
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
        
        // Add shimmer for 3 stars
        if (starNumber === 3) {
          const shimmer = this.ctx.createOscillator();
          const shimmerGain = this.ctx.createGain();
          shimmer.type = 'sine';
          shimmer.frequency.value = freq * 2;
          shimmerGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
          shimmerGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
          shimmer.connect(shimmerGain);
          shimmerGain.connect(this.masterGain);
          shimmer.start();
          shimmer.stop(this.ctx.currentTime + 0.3);
        }
      }, i * 120);
    });
    
    // Haptic celebration
    if (starNumber === 3) {
      this.vibrate([50, 50, 50, 50, 100]);
    } else {
      this.vibrate([50, 30, 50]);
    }
  }

  // === PERFECT DOCK CHIME ===
  playPerfectDock() {
    // Legacy method - calls 3-star version
    this.playSuccessJingle(3);
  }
  
  playSuccessJingle(stars = 3) {
    if (!this.ctx) return;
    
    // Dock lock sound for all
    this.playDockLock();
    
    setTimeout(() => {
      if (stars === 1) {
        // 1 Star: Simple two-note confirmation
        const notes = [523, 659]; // C5, E5
        notes.forEach((freq, i) => {
          setTimeout(() => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.3);
          }, i * 120);
        });
      } else if (stars === 2) {
        // 2 Stars: Ascending three-note chord
        const notes = [523, 659, 784]; // C5, E5, G5 (C major)
        notes.forEach((freq, i) => {
          setTimeout(() => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.11, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.4);
          }, i * 100);
        });
      } else {
        // 3 Stars: Full triumphant fanfare
        const notes = [784, 988, 1175, 1568]; // G5, B5, D6, G6 (G major arpeggio)
        notes.forEach((freq, i) => {
          setTimeout(() => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.5);
          }, i * 80);
        });
        
        // Extra shimmer for 3 stars
        setTimeout(() => {
          const shimmer = this.ctx.createOscillator();
          const shimmerGain = this.ctx.createGain();
          shimmer.type = 'sine';
          shimmer.frequency.value = 2093; // C7 - high sparkle
          shimmerGain.gain.setValueAtTime(0.06, this.ctx.currentTime);
          shimmerGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
          shimmer.connect(shimmerGain);
          shimmerGain.connect(this.masterGain);
          shimmer.start();
          shimmer.stop(this.ctx.currentTime + 0.3);
        }, 350);
      }
    }, 200);
    
    // Haptic feedback based on stars
    if (stars === 3) {
      this.vibrate([100, 50, 100]);
    } else if (stars === 2) {
      this.vibrate([80, 40, 80]);
    } else {
      this.vibrate([60]);
    }
  }

  // === NEAR MISS WARNING ===
  playNearMiss() {
    if (!this.ctx) return;
    
    // Quick warning beep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
    
    // Sharp haptic
    this.vibrate(40);
  }

  // === RAIN SOUNDS ===
  startRain(intensity = 0.7) {
    if (!this.ctx || this.rainActive) return;
    this.rainActive = true;
    
    // Rain on roof - filtered noise
    const rainBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate);
    const rainData = rainBuffer.getChannelData(0);
    for (let i = 0; i < rainData.length; i++) {
      rainData[i] = (Math.random() * 2 - 1) * 0.3;
    }
    
    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = rainBuffer;
    rainSource.loop = true;
    
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 3000;
    rainFilter.Q.value = 0.5;
    
    const rainGain = this.ctx.createGain();
    rainGain.gain.value = 0.08 * intensity;
    
    rainSource.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(this.masterGain);
    rainSource.start();
    
    this.rainSources.push({ source: rainSource, gain: rainGain });
    
    // Occasional heavy drops
    const playDrop = () => {
      if (!this.rainActive || !this.ctx) return;
      
      const dropBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
      const dropData = dropBuffer.getChannelData(0);
      for (let i = 0; i < dropData.length; i++) {
        dropData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (dropData.length * 0.3));
      }
      
      const drop = this.ctx.createBufferSource();
      drop.buffer = dropBuffer;
      const dropGain = this.ctx.createGain();
      dropGain.gain.value = 0.1 * intensity;
      drop.connect(dropGain);
      dropGain.connect(this.masterGain);
      drop.start();
      
      setTimeout(playDrop, 200 + Math.random() * 500);
    };
    
    setTimeout(playDrop, 500);
  }

  stopRain() {
    this.rainActive = false;
    this.rainSources.forEach(r => {
      try { r.source.stop(); } catch (e) {}
    });
    this.rainSources = [];
  }

  // === THUNDER ===
  playThunder(intensity = 1) {
    if (!this.ctx) return;
    
    // Low rumbling thunder
    const duration = 2 + Math.random() * 2;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const envelope = Math.sin(t / duration * Math.PI) * Math.exp(-t * 0.5);
      data[i] = (Math.random() * 2 - 1) * envelope * intensity;
    }
    
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    
    const gain = this.ctx.createGain();
    gain.gain.value = 0.4;
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    
    // Haptic rumble
    this.vibrate([100, 50, 150, 50, 200]);
  }

  // === COLLISION WITH HAPTIC ===
  playCollision(intensity = 1) {
    if (!this.ctx) return;
    
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.12)) * intensity;
    }
    
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    gain.gain.value = 0.5;
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    
    // Strong haptic feedback
    this.vibrate([80, 30, 50]);
  }

  // === ENHANCED WAREHOUSE AMBIENCE ===
  startWarehouseAmbience(environment = 'warehouse', timeOfDay = 'day') {
    if (!this.ctx || this.ambienceActive) return;
    this.ambienceActive = true;
    this.currentEnvironment = environment;
    
    // Base HVAC hum frequency varies by environment
    const hvacFreq = environment === 'industrial' ? 50 : environment === 'retail' ? 70 : 60;
    const hvacVol = timeOfDay === 'night' ? 0.015 : 0.02;
    
    // Background HVAC hum
    const hvac = this.ctx.createOscillator();
    const hvacGain = this.ctx.createGain();
    const hvacFilter = this.ctx.createBiquadFilter();
    hvac.type = 'sawtooth';
    hvac.frequency.value = hvacFreq;
    hvacFilter.type = 'lowpass';
    hvacFilter.frequency.value = 120;
    hvacGain.gain.value = hvacVol;
    hvac.connect(hvacFilter);
    hvacFilter.connect(hvacGain);
    hvacGain.connect(this.masterGain);
    hvac.start();
    this.hvacOsc = hvac;
    
    // Forklift beeps (more frequent in warehouse, less in retail)
    const forkliftDelay = environment === 'retail' ? 6000 : environment === 'industrial' ? 2000 : 3500;
    const playForkliftBeep = () => {
      if (!this.ctx || !this.ambienceActive) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 1100 + Math.random() * 300;
      gain.gain.setValueAtTime(0.025, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
      
      if (this.ambienceActive) {
        setTimeout(playForkliftBeep, forkliftDelay + Math.random() * forkliftDelay);
      }
    };
    
    // Distant pallet drops
    const playPalletDrop = () => {
      if (!this.ctx || !this.ambienceActive) return;
      
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.1)) * 0.15;
      }
      
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      gain.gain.value = 0.15;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      source.start();
      
      if (this.ambienceActive) {
        setTimeout(playPalletDrop, 5000 + Math.random() * 10000);
      }
    };
    
    // Distant truck horn (more at night for "working late" feel)
    const hornDelay = timeOfDay === 'night' ? 10000 : 18000;
    const playDistantHorn = () => {
      if (!this.ctx || !this.ambienceActive) return;
      
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      
      osc1.type = 'sawtooth';
      osc1.frequency.value = 280;
      osc2.type = 'sawtooth';
      osc2.frequency.value = 350;
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
      
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc1.start();
      osc2.start();
      osc1.stop(this.ctx.currentTime + 0.8);
      osc2.stop(this.ctx.currentTime + 0.8);
      
      if (this.ambienceActive) {
        setTimeout(playDistantHorn, hornDelay + Math.random() * hornDelay);
      }
    };
    
    // Night crickets
    const playNightCrickets = () => {
      if (!this.ctx || !this.ambienceActive || timeOfDay !== 'night') return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 4000 + Math.random() * 500;
      gain.gain.setValueAtTime(0.008, this.ctx.currentTime);
      gain.gain.setValueAtTime(0, this.ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.008, this.ctx.currentTime + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
      
      if (this.ambienceActive && timeOfDay === 'night') {
        setTimeout(playNightCrickets, 200 + Math.random() * 800);
      }
    };
    
    // Traffic hum for retail/urban environments
    const playTrafficHum = () => {
      if (!this.ctx || !this.ambienceActive || environment !== 'retail') return;
      
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.02;
      }
      
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = 200;
      gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 1);
      gain.gain.linearRampToValueAtTime(0.02, this.ctx.currentTime + 2);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      source.start();
      
      if (this.ambienceActive && environment === 'retail') {
        setTimeout(playTrafficHum, 8000 + Math.random() * 12000);
      }
    };
    
    setTimeout(playForkliftBeep, 2000);
    setTimeout(playPalletDrop, 4000);
    setTimeout(playDistantHorn, 8000);
    
    if (timeOfDay === 'night') {
      setTimeout(playNightCrickets, 1000);
    }
    if (environment === 'retail') {
      setTimeout(playTrafficHum, 3000);
    }
  }

  stopWarehouseAmbience() {
    this.ambienceActive = false;
    if (this.hvacOsc) {
      try { this.hvacOsc.stop(); } catch (e) {}
      this.hvacOsc = null;
    }
  }

  
  stopBackgroundMusic() {
    if (!this.musicPlaying) return;
    this.musicPlaying = false;
    
    if (this.musicGain && this.ctx) {
      // Fade out
      this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
      setTimeout(() => {
        if (this.musicGain) {
          this.musicGain.disconnect();
          this.musicGain = null;
        }
      }, 1000);
    }
  }
  
  setSFXVolume(volume) {
    // Update master gain to affect all SFX
    this.mix.master = volume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
    }
  }

  // === LEGACY METHODS (keeping for compatibility) ===
  createOscillator(type, freq, duration, gainValue = 0.3) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playReverseBeep() {
    if (!this.ctx) return;
    this.createOscillator('square', 1000, 0.15, 0.12);
  }

  playTick() {
    if (!this.ctx) return;
    // Short high-pitched tick for countdown
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880; // A5 note
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialDecayTo = 0.01;
    gain.gain.setTargetAtTime(0.01, this.ctx.currentTime, 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playCountdownGo() {
    if (!this.ctx) return;
    // Higher pitched "GO" sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1320; // E6 note - higher for "GO"
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.setTargetAtTime(0.01, this.ctx.currentTime, 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playSuccess() {
    if (!this.ctx) return;
    this.playPerfectDock();
  }

  playDockLock() {
    if (!this.ctx) return;
    // Hydraulic clunk
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
    
    // Haptic thunk
    this.vibrate(80);
  }

  playAirBrake() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.9;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / this.ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 2.5) * 0.4 * Math.sin(t * 150);
    }
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 1800;
    gain.gain.value = 0.25;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    
    this.vibrate([30, 20, 30]);
  }

  playFailure() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.6);
    
    this.vibrate([100, 50, 100, 50, 100]);
  }

  playHonk(duration = 0.6) {
    if (!this.ctx) return;
    
    // Authentic air horn - multiple frequency components
    const hornFreqs = [277, 311, 370, 415]; // Db4, Eb4, F#4, Ab4 - classic air horn chord
    
    hornFreqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      
      // Slight detune for richness
      osc.detune.value = (Math.random() - 0.5) * 10;
      
      filter.type = 'lowpass';
      filter.frequency.value = 1500;
      filter.Q.value = 1;
      
      // Attack-sustain-release envelope
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12 / (i + 1), now + 0.05); // Attack
      gain.gain.setValueAtTime(0.12 / (i + 1), now + duration - 0.1); // Sustain
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Release
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(now + duration);
    });
    
    // Add air pressure release at end
    setTimeout(() => {
      const release = this.ctx.createBufferSource();
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.3)) * 0.1;
      }
      release.buffer = buffer;
      const releaseGain = this.ctx.createGain();
      releaseGain.gain.value = 0.15;
      release.connect(releaseGain);
      releaseGain.connect(this.masterGain);
      release.start();
    }, duration * 1000 - 50);
    
    this.vibrate([50, 20, 50]);
  }

  // Stop all audio
  stopAll() {
    this.stopEngine();
    this.stopWarehouseAmbience();
    this.stopRain();
  }

  // Aliases for backward compatibility
  playDieselIdle() { this.startEngine(); }
  stopDieselIdle() { this.stopEngine(); }
  playWarehouseAmbience(environment = 'warehouse', timeOfDay = 'day') { 
    this.startWarehouseAmbience(environment, timeOfDay); 
  }
}

const audioEngine = new PremiumAudioEngine();

// Utility functions

// Particle System Manager
class ParticleSystem {
  static createExhaustParticle(x, y, angle, speed, throttleIntensity = 1) {
    // Exhaust comes from rear of truck
    const exhaustX = x - Math.cos(angle) * 60;
    const exhaustY = y - Math.sin(angle) * 60;
    
    // Exhaust direction is opposite of travel + some spread
    const exhaustAngle = angle + Math.PI + (Math.random() - 0.5) * 0.5;
    const velocity = (15 + Math.random() * 10) * throttleIntensity;
    
    // Bigger, more visible puffs when accelerating hard
    const baseSize = 4 + Math.random() * 6;
    const size = baseSize * (0.8 + throttleIntensity * 0.4);
    
    // More opaque when accelerating hard
    const opacity = Math.min(0.7, (0.35 + Math.random() * 0.25) * throttleIntensity);
    
    return {
      x: exhaustX + (Math.random() - 0.5) * 8,
      y: exhaustY + (Math.random() - 0.5) * 8,
      vx: Math.cos(exhaustAngle) * velocity,
      vy: Math.sin(exhaustAngle) * velocity - 12, // Upward drift
      size: size,
      opacity: opacity,
      life: 1.0,
      decay: 0.012 + Math.random() * 0.008, // Slower decay for longer visibility
      type: 'exhaust',
      // Darker smoke when under load (reversing or accelerating hard)
      color: throttleIntensity > 0.8 ? 'rgba(35, 35, 40,' : 
             speed < 0 ? 'rgba(45, 45, 50,' : 'rgba(65, 65, 70,',
      glow: throttleIntensity > 1.2 // Add glow for hard acceleration
    };
  }

  static createTireDustParticle(x, y, angle, side, intensity) {
    // Tire positions
    const offsetX = side === 'front' ? 40 : -35;
    const offsetY = (Math.random() > 0.5 ? 1 : -1) * 18;
    
    const tireX = x + Math.cos(angle) * offsetX - Math.sin(angle) * offsetY;
    const tireY = y + Math.sin(angle) * offsetX + Math.cos(angle) * offsetY;
    
    return {
      x: tireX,
      y: tireY,
      vx: (Math.random() - 0.5) * 30 * intensity,
      vy: (Math.random() - 0.5) * 30 * intensity - 5,
      size: 3 + Math.random() * 5,
      opacity: 0.3 + Math.random() * 0.2,
      life: 1.0,
      decay: 0.03 + Math.random() * 0.02,
      type: 'dust',
      color: 'rgba(139, 119, 101,' // Dusty brown
    };
  }

  static createSparkParticle(x, y) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = 50 + Math.random() * 100;
    
    return {
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - 30,
      size: 1 + Math.random() * 2,
      opacity: 1.0,
      life: 1.0,
      decay: 0.05 + Math.random() * 0.03,
      type: 'spark',
      color: Math.random() > 0.5 ? 'rgba(255, 200, 50,' : 'rgba(255, 150, 30,'
    };
  }

  static createDebrisParticle(x, y) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = 30 + Math.random() * 50;
    
    return {
      x: x + (Math.random() - 0.5) * 15,
      y: y + (Math.random() - 0.5) * 15,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - 20,
      size: 2 + Math.random() * 3,
      opacity: 0.8,
      life: 1.0,
      decay: 0.02 + Math.random() * 0.015,
      type: 'debris',
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 10,
      color: 'rgba(80, 80, 85,'
    };
  }

  static createRainSplash(x, y) {
    return {
      x: x,
      y: y,
      size: 2 + Math.random() * 4,
      opacity: 0.6,
      life: 1.0,
      decay: 0.1,
      type: 'splash'
    };
  }

  static updateParticles(particles, deltaTime) {
    const gravity = 200;
    
    Object.keys(particles).forEach(type => {
      particles[type] = particles[type].filter(p => {
        // Update position
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        
        // Apply gravity to some particle types
        if (p.type === 'spark' || p.type === 'debris') {
          p.vy += gravity * deltaTime;
        }
        
        // Slow down dust/exhaust
        if (p.type === 'exhaust' || p.type === 'dust') {
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.size += deltaTime * 8; // Expand over time
        }
        
        // Update rotation for debris
        if (p.rotation !== undefined) {
          p.rotation += p.rotationSpeed * deltaTime;
        }
        
        // Decay life
        p.life -= p.decay;
        p.opacity = Math.max(0, p.life * (p.type === 'spark' ? 1 : 0.7));
        
        return p.life > 0;
      });
    });
  }

  static renderParticles(ctx, particles) {
    // Render exhaust smoke
    particles.exhaust.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = p.color + p.opacity + ')';
      
      // Add subtle glow for hard acceleration exhaust
      if (p.glow && p.opacity > 0.3) {
        ctx.shadowColor = 'rgba(100, 80, 60, 0.3)';
        ctx.shadowBlur = p.size * 1.5;
      }
      
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    });

    // Render tire dust
    particles.tireDust.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = p.color + p.opacity + ')';
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Render sparks with glow
    particles.sparks.forEach(p => {
      ctx.save();
      ctx.shadowColor = p.color + '1)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color + p.opacity + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Render debris
    particles.debris.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation || 0);
      ctx.fillStyle = p.color + p.opacity + ')';
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    // Render rain splashes
    particles.rainSplash.forEach(p => {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(180, 200, 220, ${p.opacity * 0.5})`;
      ctx.lineWidth = 1;
      const radius = p.size * (1 - p.life) * 3;
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // Render heat shimmer effect near exhaust
  static renderHeatShimmer(ctx, x, y, angle, intensity) {
    if (intensity < 0.1) return;
    
    const shimmerX = x - Math.cos(angle) * 70;
    const shimmerY = y - Math.sin(angle) * 70;
    const time = Date.now() * 0.003;
    
    ctx.save();
    ctx.globalAlpha = intensity * 0.15;
    ctx.translate(shimmerX, shimmerY);
    ctx.rotate(angle);
    
    // Create wavy distortion lines
    for (let i = 0; i < 8; i++) {
      const yOffset = (i - 4) * 6;
      const wave = Math.sin(time + i * 0.5) * 3;
      
      ctx.strokeStyle = `rgba(255, 250, 240, ${0.1 + Math.sin(time + i) * 0.05})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-20, yOffset + wave);
      ctx.quadraticCurveTo(-35, yOffset - wave, -50, yOffset + wave * 0.5);
      ctx.stroke();
    }
    
    // Heat distortion circles
    for (let i = 0; i < 3; i++) {
      const dist = 25 + i * 15;
      const wobble = Math.sin(time * 2 + i) * 5;
      
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255, 245, 230, ${0.08 - i * 0.02})`;
      ctx.ellipse(-dist, wobble, 8, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    ctx.restore();
  }
}

const normalizeAngle = (angle) => {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
};

const getCorners = (x, y, width, height, angle) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hw = width / 2;
  const hh = height / 2;
  return [
    { x: x + cos * hw - sin * hh, y: y + sin * hw + cos * hh },
    { x: x - cos * hw - sin * hh, y: y - sin * hw + cos * hh },
    { x: x - cos * hw + sin * hh, y: y - sin * hw - cos * hh },
    { x: x + cos * hw + sin * hh, y: y + sin * hw - cos * hh }
  ];
};

const projectPolygon = (corners, axis) => {
  let min = Infinity, max = -Infinity;
  corners.forEach(c => {
    const proj = c.x * axis.x + c.y * axis.y;
    min = Math.min(min, proj);
    max = Math.max(max, proj);
  });
  return { min, max };
};

const polygonsOverlap = (corners1, corners2) => {
  const getAxes = (corners) => {
    const axes = [];
    for (let i = 0; i < corners.length; i++) {
      const next = (i + 1) % corners.length;
      const edge = { x: corners[next].x - corners[i].x, y: corners[next].y - corners[i].y };
      const len = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
      axes.push({ x: -edge.y / len, y: edge.x / len });
    }
    return axes;
  };

  const axes = [...getAxes(corners1), ...getAxes(corners2)];
  for (const axis of axes) {
    const p1 = projectPolygon(corners1, axis);
    const p2 = projectPolygon(corners2, axis);
    if (p1.max < p2.min || p2.max < p1.min) return false;
  }
  return true;
};

const calculateScore = (collisions, timeOver, alignmentError, distance, timeLimit, elapsed, perfect, noCollisions, firstTry, pullUps = 0) => {
  let score = 100;
  score -= collisions * 15;
  score -= pullUps * 8; // Each pull-up deducts 8 points
  if (timeOver > 0) score -= Math.floor(timeOver / 5);
  score -= alignmentError * 2;
  score -= distance * 0.5;
  if (perfect) score += 10;
  if (noCollisions) score += 15;
  if (pullUps === 0) score += 10; // Bonus for no pull-ups
  if (elapsed < timeLimit * 0.6) score += 20;
  if (firstTry && score >= 80) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
};

// Calculate attempt penalty multiplier
const getAttemptMultiplier = (attempts) => {
  if (attempts <= 1) return 1.0;    // 100% - First try
  if (attempts === 2) return 0.75;  // 75% - Second try
  if (attempts === 3) return 0.50;  // 50% - Third try
  return 0.25;                       // 25% - Fourth try or more (minimum)
};

const getGrade = (score) => {
  if (score >= 95) return { letter: 'S', color: THEME.uiGold, label: 'PERFECT' };
  if (score >= 85) return { letter: 'A', color: THEME.uiSuccess, label: 'EXCELLENT' };
  if (score >= 75) return { letter: 'B', color: '#60a5fa', label: 'GOOD' };
  if (score >= 65) return { letter: 'C', color: THEME.uiWarning, label: 'PASS' };
  if (score >= 50) return { letter: 'D', color: '#f97316', label: 'POOR' };
  return { letter: 'F', color: THEME.uiDanger, label: 'FAIL' };
};

// Main Game Component
const DockBackingGameInner = React.memo(function DockBackingGameInner({ difficulty = 'normal', truckConfig = {}, onComplete, onCancel, embedded = false, embeddedLevel = 1 }) {
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const renderRef = useRef();
  const lastTimeRef = useRef(0);
  const reverseBeepRef = useRef(0);
  const turnSignalRef = useRef(0);
  const dockLightRef = useRef(0);
  const lastNearMissRef = useRef(0);
  const ambienceIntervalRef = useRef(null);
  
  // Refs for render data (prevents render loop restarts)
  const truckRef = useRef(null);
  const aiTruckRef = useRef(null);
  const tireMarksRef = useRef([]);
  const movingObstaclesRef = useRef([]);
  const screenShakeRef = useRef({ x: 0, y: 0 });
  const showCollisionFlashRef = useRef(false);
  const slowMotionRef = useRef(false);
  const collisionHandledRef = useRef(false);
  const dockLockAnimationRef = useRef(0);
  const pullUpsRef = useRef(0);
  const timeRemainingRef = useRef(null);
  const collisionsRef = useRef(0);
  const attemptsRef = useRef(1);
  const gameModeRef = useRef('standard');
  const currentLevelRef = useRef(1);
  const initLevelRef = useRef(null);

  // Game state
  const [gameState, setGameState] = useState('menu');
  const [failReason, setFailReason] = useState(null); // 'collision', 'timeout', 'pullups'
  const [countdown, setCountdown] = useState(null); // null, 3, 2, 1, 'GO'
  const [currentLevel, setCurrentLevel] = useState(1);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [truck, setTruck] = useState(null);
  const [aiTruck, setAiTruck] = useState(null);
  const [movingObstacles, setMovingObstacles] = useState([]);
  const [tireMarks, setTireMarks] = useState([]);
  
  // Game mode state
  const [gameMode, setGameMode] = useState('standard');
  const enduranceProgress = { level: 1, totalScore: 0, totalCollisions: 0 }; // Stub
  
  // Environment state
  const [currentEnvironment, setCurrentEnvironment] = useState('warehouse');
  const [currentWeather, setCurrentWeather] = useState('clear');
  const [timeOfDay, setTimeOfDay] = useState('noon');
  const snowAccumulationRef = useRef(0);
  
  // Truck customization state
  const [truckCustomization, setTruckCustomization] = useState({
    color: 'blue',
    cabStyle: 'standard',
    boxStyle: 'ribbed',
    decal: 'none',
    accessories: ['lightbar', 'mudflaps'],
  });
  const [unlockedCustomizations, setUnlockedCustomizations] = useState({
    colors: ['white', 'blue', 'red'],
    cabStyles: ['standard'],
    boxStyles: ['plain', 'ribbed'],
    decals: ['none'],
    accessories: ['lightbar', 'mudflaps'],
  });
  const [showCustomization, setShowCustomization] = useState(false);
  
  // Stats & scoring
  const [score, setScore] = useState(0);
  const [collisions, setCollisions] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [attempts, setAttempts] = useState(1);
  const [endlessStreak, setEndlessStreak] = useState(0);
  const [pullUps, setPullUps] = useState(0);
  const [lastDirection, setLastDirection] = useState(null); // 'forward' or 'reverse'
  
  // Settings
  const [steerSensitivity, setSteerSensitivity] = useState(1.0); // 0.5 to 1.5
  const [cameraShakeIntensity, setCameraShakeIntensity] = useState(1.0); // 0 to 1.5
  const [showSettings, setShowSettings] = useState(false);
  
  // Accessibility settings
  const [accessibility, setAccessibility] = useState(ACCESSIBILITY_DEFAULTS);
  
  // Get color based on accessibility settings
  const getAccessibleColor = useCallback((colorKey) => {
    if (accessibility.highContrast && HIGH_CONTRAST_COLORS[colorKey]) {
      return HIGH_CONTRAST_COLORS[colorKey];
    }
    if (accessibility.colorBlindMode !== 'none') {
      const palette = COLOR_BLIND_PALETTES[accessibility.colorBlindMode];
      if (palette && palette[colorKey]) {
        return palette[colorKey];
      }
    }
    return null; // Use default
  }, [accessibility]);
  
  // UI Animation states
  const [menuAnimated, setMenuAnimated] = useState(true);
  const [buttonHover, setButtonHover] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // Inject CSS animations on mount (respects reduced motion)
  useEffect(() => {
    const styleId = 'dock-game-animations';
    // Check system preference for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion && !accessibility.reducedMotion) {
      setAccessibility(prev => ({ ...prev, reducedMotion: true }));
    }
    
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      // If reduced motion, use minimal animations
      style.textContent = accessibility.reducedMotion ? `
        @keyframes fadeIn { from { opacity: 1; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 1; } to { opacity: 1; } }
        @keyframes fadeInDown { from { opacity: 1; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 1; } to { opacity: 1; } }
        @keyframes slideInLeft { from { opacity: 1; } to { opacity: 1; } }
        @keyframes slideInRight { from { opacity: 1; } to { opacity: 1; } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } }
        @keyframes shimmer { 0%, 100% { background-position: 0 0; } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } }
        @keyframes glow { 0%, 100% { box-shadow: none; } }
        @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes starPop { from { opacity: 1; } to { opacity: 1; } }
      ` : UI_ANIMATIONS;
      document.head.appendChild(style);
    }
    
    // Add mobile-specific CSS
    const mobileStyleId = 'dock-game-mobile';
    if (!document.getElementById(mobileStyleId)) {
      const mobileStyle = document.createElement('style');
      mobileStyle.id = mobileStyleId;
      mobileStyle.textContent = `
        /* Prevent text selection on touch */
        .dock-game-container {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
        /* Prevent pull-to-refresh and overscroll */
        body {
          overscroll-behavior: none;
        }
        /* Prevent double-tap zoom */
        .dock-game-container button,
        .dock-game-container canvas {
          touch-action: manipulation;
        }
        /* Safe area padding for notched devices */
        @supports (padding: env(safe-area-inset-left)) {
          .dock-game-container {
            padding-left: env(safe-area-inset-left);
            padding-right: env(safe-area-inset-right);
            padding-bottom: env(safe-area-inset-bottom);
          }
          .mobile-controls-left {
            left: max(10px, env(safe-area-inset-left)) !important;
          }
          .mobile-controls-right {
            right: max(10px, env(safe-area-inset-right)) !important;
          }
          .mobile-hud-top {
            top: max(10px, env(safe-area-inset-top)) !important;
          }
          .mobile-hud-bottom {
            bottom: max(10px, env(safe-area-inset-bottom)) !important;
          }
        }
        /* Dynamic viewport height for mobile browsers */
        :root {
          --app-height: 100vh;
        }
        @supports (height: 100dvh) {
          :root {
            --app-height: 100dvh;
          }
        }
        /* Portrait mode: rotate entire container 90° so game always renders landscape */
        @media screen and (orientation: portrait) {
          .dock-game-container {
            width: 100vh !important;
            height: 100vw !important;
            transform: rotate(90deg) !important;
            transform-origin: 0 0 !important;
            position: fixed !important;
            top: 0 !important;
            left: 100vw !important;
            overflow: hidden !important;
          }
          .landscape-hint {
            display: none !important;
          }
        }
        @media screen and (orientation: landscape) {
          .landscape-hint {
            display: none !important;
          }
        }
        /* Prevent iOS rubber banding */
        .dock-game-container {
          position: fixed;
          inset: 0;
          overflow: hidden;
        }
        /* Ensure minimum touch target sizes */
        .touch-target {
          min-width: 44px;
          min-height: 44px;
        }
        /* Scale controls on very small screens — never below 44px (Apple HIG / Google MD minimum) */
        @media screen and (max-height: 400px) {
          .mobile-action-btn {
            width: 44px !important;
            height: 44px !important;
            font-size: 17px !important;
          }
          .mobile-dpad {
            width: 120px !important;
            height: 120px !important;
          }
          .mobile-dpad svg {
            width: 120px !important;
            height: 120px !important;
          }
          .mobile-wheel {
            width: 110px !important;
            height: 110px !important;
          }
          .mobile-pedal {
            width: 76px !important;
            height: 52px !important;
            font-size: 12px !important;
          }
        }
        @media screen and (max-width: 700px) and (orientation: landscape) {
          .mobile-action-btn {
            width: 44px !important;
            height: 44px !important;
            font-size: 18px !important;
          }
        }
      `;
      document.head.appendChild(mobileStyle);
    }
    
    // Trigger menu animation after brief delay
    setTimeout(() => setMenuAnimated(true), accessibility.reducedMotion ? 0 : 100);
    return () => {
      const style = document.getElementById(styleId);
      if (style) style.remove();
      const mobileStyle = document.getElementById(mobileStyleId);
      if (mobileStyle) mobileStyle.remove();
    };
  }, [accessibility.reducedMotion]);
  
  // Progression
  const [unlockedLevels, setUnlockedLevels] = useState([1, 2, 3]);
  const [highScores, setHighScores] = useState({});
  const [levelStars, setLevelStars] = useState({}); // Stars earned per level (1-3)
  const [levelTimes, setLevelTimes] = useState({}); // Best times per level
  

  // UI state
  const [muted, setMuted] = useState(false);
  const [sfxVolume, setSfxVolume] = useState(0.7);
  const [showCollisionFlash, setShowCollisionFlash] = useState(false);
  const [slowMotion, setSlowMotion] = useState(false);
  const [screenShake, setScreenShake] = useState({ x: 0, y: 0 });
  const [dockLockAnimation, setDockLockAnimation] = useState(0);
  const [airBrakeAnimation, setAirBrakeAnimation] = useState(false);
  
  // Camera system (simplified for minigame)
  const [cameraZoom, setCameraZoom] = useState(1.0); // 0.5 to 2.0
  const [cameraMode, setCameraMode] = useState('fixed'); // fixed, follow, cinematic, overhead
  const cameraSmoothRef = useRef({ x: 0, y: 0, zoom: 1 });
  
  // Stub state for removed features (minigame simplification)
  const stats = { totalAttempts: 0, successfulDocks: 0, perfectDocks: 0, totalCollisions: 0, bestEndlessStreak: 0, totalXP: 0, totalStars: 0, nightLevelsCompleted: 0, rainLevelsCompleted: 0 };
  
  // Particle system refs
  // === PERF: Refs for all per-frame mutable data — game loop reads/writes these directly,
  //     avoiding React state updates (and useEffect restarts) on every frame.
  const inputRef = useRef({ forward: false, reverse: false, left: false, right: false, brake: false });
  const joystickDataRef = useRef(null);
  const dpadStateRef = useRef({ up: false, down: false, left: false, right: false, brake: false });
  const wheelAngleRef = useRef(0);
  const pedalStateRef = useRef({ drive: false, reverse: false, brake: false });
  const lastTireMarkPosRef = useRef(null);

  const particlesRef = useRef({
    exhaust: [],      // Smoke from exhaust pipe
    tireDust: [],     // Dust/smoke from tires
    sparks: [],       // Sparks on collision
    debris: [],       // Small debris particles
    rainSplash: [],   // Rain splash effects
    confetti: [],     // Victory confetti
  });
  const lastExhaustTime = useRef(0);
  const lastTireDustTime = useRef(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFailureEffect, setShowFailureEffect] = useState(false);
  
  // PERF: Pre-compute debris particle properties once — Math.random() inside JSX
  // re-randomizes on every React re-render (60×/sec during gameplay)
  const failureDebrisParticles = useMemo(() => 
    Array.from({ length: 50 }).map((_, i) => {
      const isEmber = i < 20;
      const colors = isEmber
        ? ['#ef4444', '#f97316', '#fbbf24', '#dc2626', '#b91c1c']
        : ['#374151', '#4b5563', '#6b7280', '#52525b', '#44403c'];
      return {
        color: colors[i % colors.length],
        left: 30 + Math.random() * 40,
        delay: Math.random() * 0.8,
        duration: 1.5 + Math.random() * 2,
        size: isEmber ? (3 + Math.random() * 5) : (6 + Math.random() * 10),
        heightRatio: 0.3 + Math.random() * 0.7,
        rotation: Math.random() * 360,
        glowSize: 4 + Math.random() * 6,
        isEmber,
      };
    })
  , []); // stable for lifetime of component
  
  // Input
  const [input, setInput] = useState({ forward: false, reverse: false, left: false, right: false, brake: false });
  const [joystickData, setJoystickData] = useState(null);
  // Control scheme detection and state
  const [controlScheme, setControlScheme] = useState('auto'); // 'auto', 'dpad', 'wheel', 'keyboard'
  const [mobileControlType, setMobileControlType] = useState('dpad'); // 'dpad' or 'wheel' for mobile
  const [isPortrait, setIsPortrait] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches
  );

  const deviceType = useMemo(() => {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth < 1024;
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    
    // Mobile/tablet: touch + small screen + coarse pointer (no precise mouse)
    if (hasTouch && isSmallScreen && hasCoarsePointer) return 'mobile';
    // Touch laptop: has touch but also has fine pointer (trackpad/mouse)
    if (hasTouch && !hasCoarsePointer) return 'desktop';
    // Desktop: no touch
    return 'desktop';
  }, []);
  
  const useTouch = useMemo(() => {
    if (controlScheme === 'auto') return deviceType === 'mobile';
    return controlScheme === 'touch';
  }, [controlScheme, deviceType]);
  
  const isMobile = useTouch; // Keep for backward compatibility

  // Portrait orientation listener — enables CSS-rotation portrait support
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const handler = (e) => setIsPortrait(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Prevent browser gestures on mobile during gameplay
  useEffect(() => {
    if (!useTouch || gameState !== 'playing') return;
    
    // Prevent pull-to-refresh, pinch zoom, and other default gestures
    const preventGesture = (e) => {
      // Allow the event if it's on an input element
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Prevent default for multi-touch (pinch zoom)
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };
    
    const preventContextMenu = (e) => {
      e.preventDefault();
    };
    
    document.addEventListener('touchmove', preventGesture, { passive: false });
    document.addEventListener('touchstart', preventGesture, { passive: false });
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('gesturestart', preventGesture);
    document.addEventListener('gesturechange', preventGesture);
    document.addEventListener('gestureend', preventGesture);
    
    return () => {
      document.removeEventListener('touchmove', preventGesture);
      document.removeEventListener('touchstart', preventGesture);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
    };
  }, [useTouch, gameState]);
  
  // Steering wheel state
  const [wheelAngle, setWheelAngle] = useState(0);
  const [pedalState, setPedalState] = useState({ drive: false, reverse: false, brake: false });
  const wheelStartAngle = useRef(0);
  const wheelStartRotation = useRef(0);

  // D-Pad state for mobile
  const [dpadState, setDpadState] = useState({ 
    up: false, down: false, left: false, right: false, brake: false 
  });
  const dpadTouchId = useRef(null);
  
  // Haptic feedback for mobile
  const triggerHaptic = useCallback((type = 'light') => {
    if (!accessibility.hapticFeedback) return;
    if ('vibrate' in navigator) {
      switch(type) {
        case 'light': navigator.vibrate(10); break;
        case 'medium': navigator.vibrate(25); break;
        case 'heavy': navigator.vibrate([50, 30, 50]); break;
        case 'collision': navigator.vibrate([100, 50, 100, 50, 100]); break;
        default: navigator.vibrate(10);
      }
    }
  }, [accessibility.hapticFeedback]);

  // Load progression data from localStorage on mount
  useEffect(() => {
    try {
      // Load level times
      const savedTimes = window.localStorage?.getItem('dockmaster_times');
      if (savedTimes) {
        setLevelTimes(JSON.parse(savedTimes));
      }
      
      // Load level stars
      const savedStars = window.localStorage?.getItem('dockmaster_stars');
      if (savedStars) {
        setLevelStars(JSON.parse(savedStars));
      }
      
      // Load high scores
      const savedScores = window.localStorage?.getItem('dockmaster_scores');
      if (savedScores) {
        setHighScores(JSON.parse(savedScores));
      }
      
      // Load unlocked levels
      const savedLevels = window.localStorage?.getItem('dockmaster_levels');
      if (savedLevels) {
        setUnlockedLevels(JSON.parse(savedLevels));
      }
    } catch (e) {
      console.log('Could not load saved data');
    }
  }, []);

  // Auto-start when embedded — bypass menu entirely
  useEffect(() => {
    if (!embedded) return;
    const t = setTimeout(() => startGame(embeddedLevel), 80);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Save stats to localStorage when they change
  useEffect(() => {
    try {
      window.localStorage?.setItem('dockmaster_stats', JSON.stringify(stats));
    } catch (e) {
      console.log('Could not save stats');
    }
  }, [stats]);
  
  // Save level times
  useEffect(() => {
    if (Object.keys(levelTimes).length > 0) {
      try {
        window.localStorage?.setItem('dockmaster_times', JSON.stringify(levelTimes));
      } catch (e) {}
    }
  }, [levelTimes]);
  
  // Save level stars
  useEffect(() => {
    if (Object.keys(levelStars).length > 0) {
      try {
        window.localStorage?.setItem('dockmaster_stars', JSON.stringify(levelStars));
      } catch (e) {}
    }
  }, [levelStars]);
  
  // Save high scores
  useEffect(() => {
    if (Object.keys(highScores).length > 0) {
      try {
        window.localStorage?.setItem('dockmaster_scores', JSON.stringify(highScores));
      } catch (e) {}
    }
  }, [highScores]);
  
  
  // Save unlocked levels
  useEffect(() => {
    try {
      window.localStorage?.setItem('dockmaster_levels', JSON.stringify(unlockedLevels));
    } catch (e) {}
  }, [unlockedLevels]);
  
  // Track play time (update every 10 seconds while playing)
  useEffect(() => {
    if (gameState !== 'playing') return;
    return;
  }, [gameState]);
  
  // Cleanup on component unmount - prevent memory leaks
  useEffect(() => {
    return () => {
      // Stop all audio
      try {
        audioEngine.stopEngine();
        audioEngine.stopBackgroundMusic();
      } catch (e) {
        // Ignore audio cleanup errors
      }
      
      // Cancel any pending animation frames
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (renderRef.current) {
        cancelAnimationFrame(renderRef.current);
      }
      
      // Clear refs
      truckRef.current = null;
      aiTruckRef.current = null;
    };
  }, []);
  // Sync remaining UI-display state to refs (collisions/pullUps/timeRemaining still use state for JSX display)
  useEffect(() => { screenShakeRef.current = screenShake; }, [screenShake]);
  useEffect(() => { showCollisionFlashRef.current = showCollisionFlash; }, [showCollisionFlash]);
  useEffect(() => { slowMotionRef.current = slowMotion; }, [slowMotion]);
  useEffect(() => { dockLockAnimationRef.current = dockLockAnimation; }, [dockLockAnimation]);
  useEffect(() => { pullUpsRef.current = pullUps; }, [pullUps]);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);
  useEffect(() => { collisionsRef.current = collisions; }, [collisions]);
  useEffect(() => { attemptsRef.current = attempts; }, [attempts]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { currentLevelRef.current = currentLevel; }, [currentLevel]);
  // NOTE: initLevelRef.current is updated inline after initLevel's declaration below.
  // A useEffect here would put initLevel in its deps array, causing a TDZ error because
  // initLevel is declared ~110 lines later. Inline assignment avoids that entirely.

  const levelConfig = useMemo(() => {
    let config;
    
    if (currentLevel === 'endless') {
      const diff = Math.floor(endlessStreak / 5);
      
      // Snow kicks in at higher streaks
      const endlessWeather = endlessStreak >= 6 ? 'snow' : 'clear';
      
      // Time of day progression: cycles through
      const timeProgression = ['morning', 'noon', 'evening', 'night', 'dawn'];
      const timeIndex = Math.floor(endlessStreak / 2) % timeProgression.length;
      const endlessTimeOfDay = timeProgression[timeIndex];
      
      // Add more obstacle variety at higher streaks
      const obstaclePool = ['cone', 'car', 'cart', 'dumpster'];
      if (diff >= 1) obstaclePool.push('pallet', 'barrel');
      if (diff >= 2) obstaclePool.push('forklift', 'bollard');
      if (diff >= 3) obstaclePool.push('spilledcargo', 'oilslick');
      if (diff >= 4) obstaclePool.push('puddle', 'pedestrian_zone');
      
      config = {
        name: "ENDLESS",
        subtitle: `Streak: ${endlessStreak}`,
        difficulty: diff < 2 ? "STANDARD" : diff < 4 ? "PRO" : "ELITE",
        timeLimit: Math.max(30, 60 - diff * 3),
        targetScore: 60,
        truckStart: {
          x: 150 + Math.random() * 500,
          y: 450 + Math.random() * 100,
          angle: (Math.random() - 0.5) * Math.PI / 2
        },
        dock: {
          x: 200 + Math.random() * 400,
          y: 80 + Math.random() * 30,
          width: Math.max(50, 62 - diff * 2),
          angle: (Math.random() - 0.5) * Math.PI / 3
        },
        obstacles: Array.from({ length: Math.min(10, 2 + diff) }, () => ({
          type: obstaclePool[Math.floor(Math.random() * obstaclePool.length)],
          x: 150 + Math.random() * 500,
          y: 150 + Math.random() * 300,
          width: 30 + Math.random() * 30,
          height: 20 + Math.random() * 20,
          angle: Math.random() * Math.PI / 4
        })),
        guidelines: false,
        nightMode: endlessTimeOfDay === 'night' || endlessTimeOfDay === 'evening',
        endlessWeather,
        endlessTimeOfDay,
        description: "Infinite challenges. How long can you last?"
      };
    } else {
      config = { ...LEVEL_CONFIGS[currentLevel] } || { ...LEVEL_CONFIGS[1] };
    }
    
    // Apply game mode modifiers
    const mode = GAME_MODES[gameMode];
    if (mode?.modifiers) {
      const mods = mode.modifiers;
      
      // Time Attack mode
      if (mods.timeLimit !== undefined) {
        config.timeLimit = mods.timeLimit;
      }
      
      // Precision mode
      if (mods.targetScore !== undefined) {
        config.targetScore = mods.targetScore;
      }
      if (mods.noTimeBonus) {
        config.noTimeBonus = true;
      }
      
      // Mirror mode - flip X coordinates
      if (mods.mirrorX) {
        config.mirrored = true;
        config.truckStart = {
          ...config.truckStart,
          x: CANVAS_WIDTH - config.truckStart.x,
          angle: Math.PI - config.truckStart.angle
        };
        config.dock = {
          ...config.dock,
          x: CANVAS_WIDTH - config.dock.x,
          angle: config.dock.angle === 0 ? 0 : -config.dock.angle
        };
        if (config.obstacles) {
          config.obstacles = config.obstacles.map(obs => ({
            ...obs,
            x: CANVAS_WIDTH - obs.x,
            angle: obs.angle ? -obs.angle : 0
          }));
        }
      }
      
      // Fog mode
      if (mods.fogEnabled) {
        config.fogEnabled = true;
        config.visibilityRadius = mods.visibilityRadius || 100;
      }
      
    }
    
    return config;
  }, [currentLevel, endlessStreak, gameMode]);

  // Initialize level
  const initLevel = useCallback(() => {
    // Reset failure state
    setFailReason(null);
    collisionHandledRef.current = false;
    
    // Reset visual effects from previous crash
    setShowCollisionFlash(false);
    setScreenShake({ x: 0, y: 0 });
    setSlowMotion(false);
    setShowConfetti(false);
    setShowFailureEffect(false);
    
    // Show brief loading state for visual feedback
    setIsLoading(true);
    
    const config = levelConfig;
    
    // Apply level-specific environment and weather
    if (currentLevel === 'endless') {
      if (config.endlessWeather) setCurrentWeather(config.endlessWeather);
      if (config.endlessTimeOfDay) setTimeOfDay(config.endlessTimeOfDay);
      // Endless randomizes environment each streak
      const envKeys = Object.keys(ENVIRONMENTS);
      setCurrentEnvironment(envKeys[Math.floor(Math.random() * envKeys.length)]);
    } else {
      // Standard/time attack: use level's assigned environment and weather
      if (config.environment) setCurrentEnvironment(config.environment);
      if (config.weather) setCurrentWeather(config.weather);
      setTimeOfDay(config.nightMode ? 'night' : 'noon');
    }
    
    // Use the level's strategic starting position
    const startPos = config.truckStart;
    
    // Determine load weight based on level (heavier loads in harder levels)
    const loadWeight = config.loadWeight !== undefined 
      ? config.loadWeight 
      : Math.min(PHYSICS.maxLoadWeight, (currentLevel - 1) * 1500);
    
    const truckInitial = {
      x: startPos.x,
      y: startPos.y,
      angle: startPos.angle,
      speed: 0,
      steerAngle: 0,
      braking: false,
      bodyRoll: 0,
      bodyPitch: 0,           // Forward/back tilt from accel/brake
      lastDirection: null,
      
      // Physics properties
      loadWeight: loadWeight,
      totalWeight: PHYSICS.emptyWeight + loadWeight,
      
      // Suspension state
      suspensionFL: 0,        // Front-left compression
      suspensionFR: 0,        // Front-right compression
      suspensionRL: 0,        // Rear-left compression
      suspensionRR: 0,        // Rear-right compression
      
      // Weight distribution (shifts during accel/brake/turn)
      weightFront: 0.5,       // 0-1, how much weight is on front axle
      weightLeft: 0.5,        // 0-1, how much weight is on left side
      
      // Surface traction - affected by weather and environment
      surfaceFriction: (() => {
        let friction = PHYSICS.dryAsphalt;
        
        // Snow reduces friction
        if (currentWeather === 'snow') {
          const snowWeather = WEATHER_TYPES.snow;
          if (snowWeather) friction *= snowWeather.friction;
        }
        
        // Cold storage is slippery
        const env = ENVIRONMENTS[currentEnvironment];
        if (env?.slipperyGround) friction *= 0.6;
        
        return Math.max(0.2, friction);
      })(),
      
      // Momentum tracking
      momentum: { x: 0, y: 0 },
      
      // Wheel spin (for tire smoke effects)
      wheelSpin: 0,           // Positive = spinning faster than ground speed
    };
    setTruck(truckInitial);
    truckRef.current = truckInitial;
    
    if (config.aiTruck) {
      const aiInitial = {
        ...config.aiTruck,
        x: config.aiTruck.startX,
        y: config.aiTruck.startY,
        angle: config.aiTruck.startAngle,
        speed: 0,
        steerAngle: 0,
        docked: false
      };
      setAiTruck(aiInitial);
      aiTruckRef.current = aiInitial;
    } else {
      setAiTruck(null);
      aiTruckRef.current = null;
    }
    
    if (config.movingObstacles) {
      const mobsInitial = config.movingObstacles.map(obs => ({
        ...obs,
        x: obs.startX,
        y: obs.startY,
        direction: 1
      }));
      setMovingObstacles(mobsInitial);
      movingObstaclesRef.current = mobsInitial;
    } else {
      setMovingObstacles([]);
      movingObstaclesRef.current = [];
    }
    
    setTireMarks([]);
    tireMarksRef.current = [];
    lastTireMarkPosRef.current = null; // Reset path tracking
    setCollisions(0);
    setPullUps(0);
    setLastDirection(null);
    setTimeRemaining(config.timeLimit);
    setStartTime(Date.now());
    setDockLockAnimation(0);
    setAirBrakeAnimation(false);
    setWheelAngle(0);
    setPedalState({ drive: false, reverse: false, brake: false });
    dpadStateRef.current = {up: false, down: false, left: false, right: false, brake: false }; setDpadState({up: false, down: false, left: false, right: false, brake: false });
    setInput({ forward: false, reverse: false, left: false, right: false, brake: false });
    joystickDataRef.current = null; setJoystickData(null);
    
    // Clear all particles
    particlesRef.current = {
      exhaust: [],
      tireDust: [],
      sparks: [],
      debris: [],
      rainSplash: [],
    };
    
    
    // Reset environment effects
    
    snowAccumulationRef.current = 0;
    
    // Hide loading state after brief delay for visual feedback
    setTimeout(() => setIsLoading(false), 150);
  }, [levelConfig, muted, gameState]);
  // ── Keep ref current every render so startGame's stable useCallback([]) always
  // calls the latest initLevel (which closes over current levelConfig/gameState).
  // Inline assignment avoids the forward-reference TDZ that a useEffect would cause.
  initLevelRef.current = initLevel;

  // Check and unlock achievements
  // Stub functions (achievements and stats removed for minigame)
  const checkCustomizationUnlocks = useCallback(() => {}, []);

  // Screen reader announcement helper
  const announceToScreenReader = useCallback((message) => {
    if (!accessibility.screenReaderMode) return;
    const liveRegion = document.getElementById('game-announcer');
    if (liveRegion) {
      // Clear then set to trigger announcement
      liveRegion.textContent = '';
      setTimeout(() => {
        liveRegion.textContent = message;
      }, 50);
    }
  }, [accessibility.screenReaderMode]);

  // Start game with countdown
  const startGame = useCallback((level) => {
    if (!muted) {
      audioEngine.init();
    }
    
    setCurrentLevel(level);
    
    setAttempts(1);
    setTutorialStep(0);
    
    setTimeout(() => {
      initLevelRef.current?.();
      setGameState('countdown');
      setCountdown(3);
    }, 50);
  }, [muted]);

  // Check for near misses (close calls without collision)
  const checkNearMiss = useCallback(() => {
    const truck = truckRef.current;
    if (!truck || Math.abs(truck.speed) < 5) return false;
    
    const nearMissThreshold = 15; // pixels
    const obstacles = [...(levelConfig.obstacles || []), ...movingObstaclesRef.current];
    
    for (const obs of obstacles) {
      let obsWidth, obsHeight;
      switch (obs.type) {
        case 'cone': obsWidth = 16; obsHeight = 16; break;
        case 'pedestrian': obsWidth = 14; obsHeight = 14; break;
        case 'cart': obsWidth = obs.width || 22; obsHeight = obs.height || 16; break;
        case 'car': obsWidth = obs.width || 48; obsHeight = obs.height || 26; break;
        case 'dumpster': obsWidth = obs.width || 65; obsHeight = obs.height || 45; break;
        case 'trailer': obsWidth = obs.width || 130; obsHeight = obs.height || 48; break;
        case 'bollard': obsWidth = 20; obsHeight = 20; break;
        case 'pallet': obsWidth = obs.width || 40; obsHeight = obs.height || 48; break;
        case 'forklift': obsWidth = obs.width || 35; obsHeight = obs.height || 55; break;
        case 'barrel': obsWidth = obs.width || 24; obsHeight = obs.width || 24; break;
        case 'spilledcargo': obsWidth = obs.width || 70; obsHeight = obs.height || 50; break;
        case 'pedestrian_zone': obsWidth = obs.width || 80; obsHeight = obs.height || 60; break;
        case 'moving_truck': obsWidth = obs.width || 130; obsHeight = obs.height || 48; break;
        case 'oilslick': obsWidth = 0; obsHeight = 0; break;
        case 'puddle': obsWidth = 0; obsHeight = 0; break;
        default: obsWidth = 30; obsHeight = 20;
      }
      
      // Simple distance check from truck center to obstacle center
      const dx = truck.x - obs.x;
      const dy = truck.y - obs.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minSafeDist = (TRUCK_LENGTH / 2 + Math.max(obsWidth, obsHeight) / 2);
      
      if (dist < minSafeDist + nearMissThreshold && dist > minSafeDist - 5) {
        return true;
      }
    }
    return false;
  }, [levelConfig.obstacles]);

  // Check collisions
  const checkCollisionsWithObstacles = useCallback(() => {
    const truck = truckRef.current;
    if (!truck) return false;
    const truckCorners = getCorners(truck.x, truck.y, TRUCK_LENGTH, TRUCK_WIDTH, truck.angle);
    
    // Check canvas bounds
    for (const corner of truckCorners) {
      if (corner.x < 0 || corner.x > CANVAS_WIDTH || corner.y < 0 || corner.y > CANVAS_HEIGHT) {
        return true;
      }
    }
    
    // Check obstacles
    const obstacles = [...(levelConfig.obstacles || []), ...movingObstaclesRef.current];
    for (const obs of obstacles) {
      let obsWidth, obsHeight;
      switch (obs.type) {
        case 'cone': obsWidth = 16; obsHeight = 16; break;
        case 'pedestrian': obsWidth = 14; obsHeight = 14; break;
        case 'cart': obsWidth = obs.width || 22; obsHeight = obs.height || 16; break;
        case 'car': obsWidth = obs.width || 48; obsHeight = obs.height || 26; break;
        case 'dumpster': obsWidth = obs.width || 65; obsHeight = obs.height || 45; break;
        case 'trailer': obsWidth = obs.width || 130; obsHeight = obs.height || 48; break;
        case 'wall': obsWidth = obs.width || 20; obsHeight = obs.height || 280; break;
        case 'bollard': obsWidth = 20; obsHeight = 20; break;
        case 'pallet': obsWidth = obs.width || 40; obsHeight = obs.height || 48; break;
        case 'forklift': obsWidth = obs.width || 35; obsHeight = obs.height || 55; break;
        case 'barrel': obsWidth = obs.width || 24; obsHeight = obs.width || 24; break;
        case 'spilledcargo': obsWidth = obs.width || 70; obsHeight = obs.height || 50; break;
        case 'pedestrian_zone': obsWidth = obs.width || 80; obsHeight = obs.height || 60; break;
        case 'moving_truck': obsWidth = obs.width || 130; obsHeight = obs.height || 48; break;
        case 'oilslick': obsWidth = 0; obsHeight = 0; break; // Pass-through hazard
        case 'puddle': obsWidth = 0; obsHeight = 0; break; // Pass-through hazard
        default: obsWidth = 30; obsHeight = 20;
      }
      
      // Skip non-solid obstacles
      if (obsWidth === 0 && obsHeight === 0) continue;
      
      const obsCorners = getCorners(obs.x, obs.y, obsWidth, obsHeight, obs.angle || 0);
      if (polygonsOverlap(truckCorners, obsCorners)) return true;
    }
    
    // Check AI truck
    if (aiTruckRef.current && !aiTruckRef.current.docked) {
      const aiCorners = getCorners(aiTruckRef.current.x, aiTruckRef.current.y, TRUCK_LENGTH, TRUCK_WIDTH, aiTruckRef.current.angle);
      if (polygonsOverlap(truckCorners, aiCorners)) return true;
    }
    
    // Check dock worker collision (safety critical!)
    const dock = levelConfig.dock;
    if (dock) {
      const workerX = dock.x + dock.width / 2 + 40;
      const workerY = dock.y + 30;
      const workerRadius = 12; // Worker body size
      
      // Check if any corner of truck is within worker's area
      for (const corner of truckCorners) {
        const dist = Math.sqrt(Math.pow(corner.x - workerX, 2) + Math.pow(corner.y - workerY, 2));
        if (dist < workerRadius + 5) { // 5px buffer
          return true;
        }
      }
      
      // Also check truck center
      const truckCenterDist = Math.sqrt(Math.pow(truck.x - workerX, 2) + Math.pow(truck.y - workerY, 2));
      if (truckCenterDist < workerRadius + TRUCK_WIDTH / 2) {
        return true;
      }
    }
    
    return false;
  }, [levelConfig.obstacles, levelConfig.dock]);

  // Check dock alignment
  const checkDockAlignment = useCallback(() => {
    const truck = truckRef.current;
    if (!truck) return { aligned: false };
    const dock = levelConfig.dock;
    
    // Calculate rear of truck position (rear is opposite of travel direction)
    const rearX = truck.x - Math.cos(truck.angle) * (TRUCK_LENGTH / 2);
    const rearY = truck.y - Math.sin(truck.angle) * (TRUCK_LENGTH / 2);
    
    const distance = Math.sqrt(Math.pow(rearX - dock.x, 2) + Math.pow(rearY - dock.y, 2));
    // Truck should be perpendicular to dock (facing 90° from dock orientation for backing in)
    const angleDiff = Math.abs(normalizeAngle(truck.angle - dock.angle - Math.PI / 2));
    
    const aligned = distance < 35 && angleDiff < 0.25;
    const perfect = distance < 18 && angleDiff < 0.1;
    
    return { aligned, perfect, distance, error: angleDiff * (180 / Math.PI) };
  }, [levelConfig.dock]);

  // Keyboard input
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') { inputRef.current = { ...inputRef.current, forward: true }; setInput(p => ({ ...p, forward: true })); }
      if (key === 's' || key === 'arrowdown') { inputRef.current = { ...inputRef.current, reverse: true }; setInput(p => ({ ...p, reverse: true })); }
      if (key === 'a' || key === 'arrowleft') { inputRef.current = { ...inputRef.current, left: true }; setInput(p => ({ ...p, left: true })); }
      if (key === 'd' || key === 'arrowright') { inputRef.current = { ...inputRef.current, right: true }; setInput(p => ({ ...p, right: true })); }
      if (key === ' ') { inputRef.current = { ...inputRef.current, brake: true }; setInput(p => ({ ...p, brake: true })); }
      if (key === 'escape') setGameState('paused');
      if (key === 'm') setMuted(p => !p); // Toggle mute
      
      // R key to restart level (only during play, success, or failed states)
      if (key === 'r' && (gameState === 'playing' || gameState === 'success' || gameState === 'failed')) {
        setAttempts(prev => prev + 1);
        setCollisions(0);
        setPullUps(0);
        initLevel();
        setGameState('countdown');
        setCountdown(3);
      }
      
      // Screen reader status announcement
      if (e.key === '?' && accessibility.screenReaderMode) {
        const statusMsg = `Level ${currentLevel}. Score: ${score}. Collisions: ${collisions}. ${timeRemaining ? `Time remaining: ${Math.ceil(timeRemaining)} seconds.` : 'No time limit.'}`;
        announceToScreenReader(statusMsg);
      }
      
      // Camera controls
      if (key === 'z') setCameraZoom(prev => Math.min(2.0, prev + 0.1));
      if (key === 'x') setCameraZoom(prev => Math.max(0.5, prev - 0.1));
      if (key === '1') setCameraZoom(1.0); // Reset zoom
    };
    
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') { inputRef.current = { ...inputRef.current, forward: false }; setInput(p => ({ ...p, forward: false })); }
      if (key === 's' || key === 'arrowdown') { inputRef.current = { ...inputRef.current, reverse: false }; setInput(p => ({ ...p, reverse: false })); }
      if (key === 'a' || key === 'arrowleft') { inputRef.current = { ...inputRef.current, left: false }; setInput(p => ({ ...p, left: false })); }
      if (key === 'd' || key === 'arrowright') { inputRef.current = { ...inputRef.current, right: false }; setInput(p => ({ ...p, right: false })); }
      if (key === ' ') { inputRef.current = { ...inputRef.current, brake: false }; setInput(p => ({ ...p, brake: false })); }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, accessibility.screenReaderMode, announceToScreenReader, currentLevel, score, collisions, timeRemaining, initLevel]);

  // Update SFX volume when slider changes
  useEffect(() => {
    if (!muted) {
      audioEngine.setSFXVolume(sfxVolume);
    }
  }, [sfxVolume, muted]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown === 'GO') {
      // Play GO sound and start game
      if (!muted) {
        audioEngine.init();
        audioEngine.playCountdownGo();
      }
      const timer = setTimeout(() => {
        setCountdown(null);
        setStartTime(Date.now()); // Reset timer to start NOW, not when initLevel ran
        setGameState('playing');
      }, 600);
      return () => clearTimeout(timer);
    }
    
    if (countdown > 0) {
      // Play tick sound on initial countdown display
      if (!muted) {
        audioEngine.init();
        audioEngine.playTick();
      }
      // Count down 3, 2, 1
      const timer = setTimeout(() => {
        const next = countdown - 1;
        setCountdown(next === 0 ? 'GO' : next);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [countdown, muted]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (!truckRef.current) return;
    
    const gameLoop = (timestamp) => {
      let deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;
      
      // Apply slow motion effect on collision
      if (slowMotionRef.current) {
        deltaTime *= 0.25; // 25% speed during slow-mo
      }
      
      // Process input based on control mode — read from refs, not React state
      let inputState = { ...inputRef.current };
      
      if (useTouch) {
        const dp = dpadStateRef.current;
        const ws = wheelAngleRef.current;
        const ps = pedalStateRef.current;
        if (mobileControlType === 'dpad') {
          // D-Pad input with 8-way diagonal support
          inputState.forward = dp.up;
          inputState.reverse = dp.down;
          inputState.left = dp.left;
          inputState.right = dp.right;
          inputState.brake = dp.brake;
          
          // Dynamic steering magnitude based on movement type
          const isTurning = dp.left || dp.right;
          const isMoving = dp.up || dp.down;
          const isDiagonal = isTurning && isMoving;
          
          // Diagonals use reduced steering for smoother turns while moving
          // Pure left/right (stationary turn) uses full steering
          inputState.steerMagnitude = isTurning ? (isDiagonal ? 0.6 : 1.0) : 0;
          inputState.steerDirection = dp.left ? -1 : dp.right ? 1 : 0;
        } else {
          // Steering wheel + pedals input (analog)
          const steerInput = ws / 150; // Normalize -150 to 150 degrees to -1 to 1
          inputState.left = steerInput < -0.1;
          inputState.right = steerInput > 0.1;
          inputState.forward = ps.drive;
          inputState.reverse = ps.reverse;
          inputState.brake = ps.brake;
          // Store steer magnitude for analog steering
          inputState.steerMagnitude = Math.abs(steerInput);
          inputState.steerDirection = Math.sign(steerInput);
        }
      } else if (joystickDataRef.current) {
        // Legacy joystick fallback
        const { angle, magnitude } = joystickDataRef.current;
        if (magnitude > 0.2) {
          if (Math.abs(Math.cos(angle)) > 0.3) {
            inputState.left = Math.cos(angle) < -0.3;
            inputState.right = Math.cos(angle) > 0.3;
          }
          if (Math.sin(angle) < -0.3) inputState.forward = true;
          if (Math.sin(angle) > 0.3) inputState.reverse = true;
        }
      }
      
      // Update truck physics — write directly to ref, NO setState on the hot path
      const prevTruck = truckRef.current;
      if (prevTruck) {
        
        // === WEIGHT-BASED PHYSICS ===
        const weightRatio = prevTruck.totalWeight / PHYSICS.emptyWeight;
        const loadFactor = prevTruck.loadWeight / PHYSICS.maxLoadWeight; // 0-1
        
        // Heavier trucks accelerate slower, brake slower, but have more momentum
        const acceleration = PHYSICS.baseAcceleration / (0.7 + weightRatio * 0.3);
        const deceleration = PHYSICS.baseDeceleration / (0.6 + weightRatio * 0.4);
        const brakeForce = PHYSICS.brakeForce / (0.8 + weightRatio * 0.2);
        
        // Max speeds reduced slightly with load
        let maxForward = PHYSICS.maxForwardSpeed * (1 - loadFactor * 0.15);
        let maxReverse = PHYSICS.maxReverseSpeed * (1 - loadFactor * 0.1);
        
        // Surface friction - check for hazards (oil slicks, puddles)
        let friction = prevTruck.surfaceFriction;
        const allObstacles = [...(levelConfig.obstacles || []), ...movingObstaclesRef.current];
        for (const obs of allObstacles) {
          if (obs.type === 'oilslick' || obs.type === 'puddle') {
            const obsW = obs.width || (obs.type === 'oilslick' ? 60 : 50);
            const obsH = obs.height || (obs.type === 'oilslick' ? 40 : 35);
            const dx = prevTruck.x - obs.x;
            const dy = prevTruck.y - obs.y;
            // Check if truck center is within the ellipse
            if ((dx * dx) / (obsW * obsW / 4) + (dy * dy) / (obsH * obsH / 4) < 1) {
              // Truck is on the hazard
              if (obs.type === 'oilslick') {
                friction *= 0.3; // Very slippery
              } else if (obs.type === 'puddle') {
                friction *= 0.6; // Moderately slippery
              }
              break; // Only count one hazard
            }
          }
        }
        
        // Steering speed reduced with load
        const maxSteer = PHYSICS.maxSteerAngle;
        const steerSpeed = PHYSICS.baseSteerSpeed * steerSensitivity * (1 - loadFactor * 0.2);
        
        let newSpeed = prevTruck.speed;
        let newSteerAngle = prevTruck.steerAngle;
        let newBraking = false;
        let newBodyRoll = prevTruck.bodyRoll;
        let newBodyPitch = prevTruck.bodyPitch || 0;
        let newWheelSpin = prevTruck.wheelSpin || 0;
        
        // Weight distribution updates
        let newWeightFront = prevTruck.weightFront || 0.5;
        let newWeightLeft = prevTruck.weightLeft || 0.5;
        
        // === THROTTLE & BRAKING ===
        if (inputState.brake) {
          // Braking force affected by friction and weight
          const brakeEfficiency = brakeForce * friction * deltaTime;
          if (Math.abs(newSpeed) > brakeEfficiency) {
            newSpeed -= Math.sign(newSpeed) * brakeEfficiency;
          } else {
            newSpeed = 0;
          }
          newBraking = true;
          
          // Weight shifts forward when braking
          newWeightFront += (0.7 - newWeightFront) * PHYSICS.weightTransferRate;
          newBodyPitch += (PHYSICS.maxBodyPitch - newBodyPitch) * PHYSICS.suspensionStiffness;
          
        } else if (inputState.forward) {
          // Acceleration affected by weight and friction
          const accelForce = acceleration * friction * deltaTime;
          
          // Check for wheel spin (too much throttle on slippery surface)
          if (friction < 0.8 && Math.abs(newSpeed) < 20) {
            newWheelSpin = Math.min(1, newWheelSpin + deltaTime * 2);
            // Reduced acceleration when spinning
            newSpeed = Math.min(newSpeed + accelForce * (1 - newWheelSpin * 0.5), maxForward);
          } else {
            newWheelSpin = Math.max(0, newWheelSpin - deltaTime * 3);
            newSpeed = Math.min(newSpeed + accelForce, maxForward);
          }
          
          // Weight shifts backward when accelerating
          newWeightFront += (0.35 - newWeightFront) * PHYSICS.weightTransferRate;
          newBodyPitch += (-PHYSICS.maxBodyPitch * 0.5 - newBodyPitch) * PHYSICS.suspensionStiffness;
          
        } else if (inputState.reverse) {
          const accelForce = acceleration * friction * deltaTime * 0.8; // Reverse is slower
          
          if (friction < 0.8 && Math.abs(newSpeed) < 15) {
            newWheelSpin = Math.min(1, newWheelSpin + deltaTime * 1.5);
            newSpeed = Math.max(newSpeed - accelForce * (1 - newWheelSpin * 0.5), -maxReverse);
          } else {
            newWheelSpin = Math.max(0, newWheelSpin - deltaTime * 3);
            newSpeed = Math.max(newSpeed - accelForce, -maxReverse);
          }
          
          // Weight shifts forward slightly when reversing
          newWeightFront += (0.55 - newWeightFront) * PHYSICS.weightTransferRate;
          
        } else {
          // Coasting - momentum based on weight
          const momentum = PHYSICS.baseMomentum + loadFactor * 0.01;
          const coastDecel = deceleration * friction * deltaTime;
          
          if (newSpeed > 0) {
            newSpeed = Math.max(0, newSpeed * momentum - coastDecel * 0.5);
          } else if (newSpeed < 0) {
            newSpeed = Math.min(0, newSpeed * momentum + coastDecel * 0.5);
          }
          
          // Weight returns to center
          newWeightFront += (0.5 - newWeightFront) * PHYSICS.weightTransferRate * 0.5;
          newWheelSpin = Math.max(0, newWheelSpin - deltaTime * 4);
        }
        
        // Body pitch returns to neutral
        newBodyPitch += (0 - newBodyPitch) * PHYSICS.suspensionDamping * deltaTime * 2;
        
        // === STEERING ===
        // Steering effectiveness reduced at high speed and with heavy loads
        const speedFactor = 1 - Math.min(0.4, Math.abs(newSpeed) / maxForward * 0.4);
        const effectiveSteerSpeed = steerSpeed * speedFactor;
        
        if (inputState.steerMagnitude !== undefined) {
          // Analog steering from wheel
          const targetSteer = inputState.steerDirection * inputState.steerMagnitude * maxSteer;
          newSteerAngle += (targetSteer - newSteerAngle) * 0.15;
        } else if (inputState.left) {
          newSteerAngle = Math.max(newSteerAngle - effectiveSteerSpeed * deltaTime, -maxSteer);
        } else if (inputState.right) {
          newSteerAngle = Math.min(newSteerAngle + effectiveSteerSpeed * deltaTime, maxSteer);
        } else {
          // Return to center faster at speed
          const returnSpeed = effectiveSteerSpeed * 2 * (1 + Math.abs(newSpeed) / 50);
          if (newSteerAngle > 0) newSteerAngle = Math.max(0, newSteerAngle - returnSpeed * deltaTime);
          else newSteerAngle = Math.min(0, newSteerAngle + returnSpeed * deltaTime);
        }
        
        // === BODY ROLL FROM TURNING ===
        // Roll increases with turn rate and speed, reduced by weight (heavier = more stable)
        const turnIntensity = Math.abs(newSteerAngle) * Math.abs(newSpeed) / (maxSteer * maxForward);
        const rollDirection = newSteerAngle * (newSpeed >= 0 ? 1 : -1);
        const targetRoll = rollDirection * PHYSICS.maxBodyRoll * (1 - loadFactor * 0.3);
        
        // Add braking pitch to roll
        const combinedRoll = targetRoll + (newBraking ? 0.01 : 0);
        newBodyRoll += (combinedRoll - newBodyRoll) * PHYSICS.suspensionStiffness;
        newBodyRoll *= PHYSICS.suspensionDamping;
        
        // Weight shifts to outside of turn
        const turnWeightShift = turnIntensity * 0.3;
        newWeightLeft += ((newSteerAngle > 0 ? 0.5 - turnWeightShift : 0.5 + turnWeightShift) - newWeightLeft) * PHYSICS.weightTransferRate;
        
        // === SUSPENSION COMPRESSION ===
        // Each corner compresses based on weight distribution
        const baseSuspension = 0.1 + loadFactor * 0.15;
        const suspFL = baseSuspension * newWeightFront * (1 - (newWeightLeft - 0.5) * 0.5);
        const suspFR = baseSuspension * newWeightFront * (1 + (newWeightLeft - 0.5) * 0.5);
        const suspRL = baseSuspension * (1 - newWeightFront) * (1 - (newWeightLeft - 0.5) * 0.5);
        const suspRR = baseSuspension * (1 - newWeightFront) * (1 + (newWeightLeft - 0.5) * 0.5);
        
        // === POSITION UPDATE ===
        const wheelBase = TRUCK_LENGTH * 0.7;
        let newAngle = prevTruck.angle;
        let newX = prevTruck.x;
        let newY = prevTruck.y;
        
        if (Math.abs(newSpeed) > 0.5) {
          // Turning radius affected by friction (slippery = wider turns)
          const frictionTurnFactor = 0.7 + friction * 0.3;
          const turnRadius = wheelBase / (Math.tan(Math.abs(newSteerAngle) * frictionTurnFactor) + 0.001);
          const angularVelocity = newSpeed / turnRadius * Math.sign(newSteerAngle);
          
          newAngle = normalizeAngle(prevTruck.angle + angularVelocity * deltaTime);
          newX = prevTruck.x + Math.cos(newAngle) * newSpeed * deltaTime;
          newY = prevTruck.y + Math.sin(newAngle) * newSpeed * deltaTime;
          
          // Add tire marks for path visualization
          const isHardTurn = Math.abs(newSteerAngle) > maxSteer * 0.6 && Math.abs(newSpeed) > 25;
          const isWheelSpin = newWheelSpin > 0.3;
          const isMoving = Math.abs(newSpeed) > 5;
          
          // Track position for path marks (every ~15 pixels moved)
          if (!lastTireMarkPosRef.current) {
            lastTireMarkPosRef.current = { x: newX, y: newY };
          }
          const distFromLastMark = Math.sqrt(
            Math.pow(newX - lastTireMarkPosRef.current.x, 2) + 
            Math.pow(newY - lastTireMarkPosRef.current.y, 2)
          );
          
          // Add path marks when moving enough distance
          if (isMoving && distFromLastMark > 15) {
            lastTireMarkPosRef.current = { x: newX, y: newY };
            const rearX = newX - Math.cos(newAngle) * TRUCK_LENGTH * 0.4;
            const rearY = newY - Math.sin(newAngle) * TRUCK_LENGTH * 0.4;
            
            // Determine mark intensity
            let opacity = 0.15; // Light path marks
            if (isHardTurn) opacity = 0.4;
            if (isWheelSpin) opacity = 0.6;
            
            // Write directly to ref — no setState inside physics loop
            tireMarksRef.current = [...tireMarksRef.current.slice(-200), {
              x: rearX,
              y: rearY,
              angle: newAngle,
              width: TRUCK_WIDTH * 0.8,
              opacity: opacity,
              isPath: !isHardTurn && !isWheelSpin // Mark as path vs skid
            }];
          }
        }
        
        // Reverse beep
        if (newSpeed < -5) {
          reverseBeepRef.current += deltaTime;
          if (reverseBeepRef.current >= 0.5) {
            reverseBeepRef.current = 0;
            if (!muted) audioEngine.playReverseBeep();
          }
        }
        
        // Track pull-ups (switching from reverse to forward)
        const currentDirection = newSpeed > 5 ? 'forward' : newSpeed < -5 ? 'reverse' : null;
        if (currentDirection === 'forward' && prevTruck.lastDirection === 'reverse') {
          pullUpsRef.current = (pullUpsRef.current || 0) + 1;
          setPullUps(pullUpsRef.current); // UI-only update
        }
        
        // Write updated truck state directly to ref — no React re-render
        truckRef.current = {
          ...prevTruck,
          x: newX,
          y: newY,
          angle: newAngle,
          speed: newSpeed,
          steerAngle: newSteerAngle,
          braking: newBraking,
          bodyRoll: newBodyRoll,
          bodyPitch: newBodyPitch,
          weightFront: newWeightFront,
          weightLeft: newWeightLeft,
          wheelSpin: newWheelSpin,
          suspensionFL: suspFL,
          suspensionFR: suspFR,
          suspensionRL: suspRL,
          suspensionRR: suspRR,
          lastDirection: currentDirection || prevTruck.lastDirection
        };
      } // end if prevTruck
      
      // Update AI truck — direct ref mutation, no setState
      if (aiTruckRef.current && !aiTruckRef.current.docked) {
        const prevAi = aiTruckRef.current;
          const targetAngle = Math.atan2(prevAi.targetY - prevAi.y, prevAi.targetX - prevAi.x) + Math.PI;
          let angleDiff = normalizeAngle(targetAngle - prevAi.angle);
          const steer = Math.max(-Math.PI / 6, Math.min(Math.PI / 6, angleDiff));
          
          const distance = Math.sqrt(Math.pow(prevAi.targetX - prevAi.x, 2) + Math.pow(prevAi.targetY - prevAi.y, 2));
          
          if (distance < 20 && Math.abs(angleDiff) < 0.1) {
            aiTruckRef.current = { ...prevAi, docked: true, speed: 0 };
          } else {
          const speed = Math.min(40, distance * 0.5);
          const wheelBase = TRUCK_LENGTH * 0.7;
          const turnRadius = wheelBase / Math.tan(Math.abs(steer) + 0.001);
          const angularVelocity = -speed / turnRadius * Math.sign(steer);
          
          const newAngle = normalizeAngle(prevAi.angle + angularVelocity * deltaTime);
          const newX = prevAi.x - Math.cos(newAngle) * speed * deltaTime;
          const newY = prevAi.y - Math.sin(newAngle) * speed * deltaTime;
          
            aiTruckRef.current = { ...prevAi, x: newX, y: newY, angle: newAngle, speed, steerAngle: steer };
          }
      }
      
      // Update moving obstacles — direct ref mutation, no setState
      if (movingObstaclesRef.current.length > 0) {
        movingObstaclesRef.current = movingObstaclesRef.current.map(obs => {
          let newX = obs.x + obs.direction * obs.speed * deltaTime;
          let newDirection = obs.direction;
          if (newX >= obs.endX || newX <= obs.startX) {
            newDirection *= -1;
            newX = Math.max(obs.startX, Math.min(obs.endX, newX));
          }
          return { ...obs, x: newX, direction: newDirection };
        });
      }
      
      // Update dock light animation
      dockLightRef.current += deltaTime;
      
      // === PARTICLE SYSTEM UPDATES ===
      if (truckRef.current) {
        const now = Date.now();
        const throttleInput = inputState.forward ? 1 : inputState.reverse ? -1 : 0;
        
        // Spawn particles only if reduced motion is off
        if (!accessibility.reducedMotion) {
          // Spawn exhaust particles when throttle is applied
          if (Math.abs(throttleInput) > 0.1 && now - lastExhaustTime.current > 80) {
            lastExhaustTime.current = now;
            // Calculate throttle intensity based on speed and input
            const speedFactor = Math.abs(truckRef.current.speed) / 60;
            const throttleIntensity = 0.5 + speedFactor + Math.abs(throttleInput) * 0.5;
            const numParticles = Math.ceil(throttleIntensity * 2);
            
            for (let i = 0; i < numParticles; i++) {
              particlesRef.current.exhaust.push(
                ParticleSystem.createExhaustParticle(truckRef.current.x, truckRef.current.y, truckRef.current.angle, truckRef.current.speed, throttleIntensity)
              );
            }
          }
          
          // Spawn tire dust on hard braking, acceleration, or wheel spin
          const isHardBraking = inputState.brake && Math.abs(truckRef.current.speed) > 20;
          const isHardAccel = Math.abs(throttleInput) > 0.8 && Math.abs(truckRef.current.speed) > 30;
          const isTurningHard = Math.abs(truckRef.current.steerAngle) > 0.3 && Math.abs(truckRef.current.speed) > 25;
          const isWheelSpinning = (truckRef.current.wheelSpin || 0) > 0.3;
          
          if ((isHardBraking || isHardAccel || isTurningHard || isWheelSpinning) && now - lastTireDustTime.current > 50) {
            lastTireDustTime.current = now;
            const baseIntensity = isHardBraking ? 1.5 : isTurningHard ? 1.0 : 0.7;
            const wheelSpinBoost = isWheelSpinning ? truckRef.current.wheelSpin * 1.5 : 0;
            const intensity = baseIntensity + wheelSpinBoost;
            
            particlesRef.current.tireDust.push(
              ParticleSystem.createTireDustParticle(truckRef.current.x, truckRef.current.y, truckRef.current.angle, 'rear', intensity)
            );
            if (isHardBraking) {
              particlesRef.current.tireDust.push(
                ParticleSystem.createTireDustParticle(truckRef.current.x, truckRef.current.y, truckRef.current.angle, 'front', intensity * 0.7)
              );
            }
            
            // Extra smoke from wheel spin (drive wheels only)
            if (isWheelSpinning) {
              particlesRef.current.tireDust.push(
                ParticleSystem.createTireDustParticle(truckRef.current.x, truckRef.current.y, truckRef.current.angle, 'rear', intensity * 0.8)
              );
            }
          }
        }
      }
      
      // Update all particles
      ParticleSystem.updateParticles(particlesRef.current, deltaTime);
      
      // Limit particle counts to prevent performance issues
      Object.keys(particlesRef.current).forEach(type => {
        if (particlesRef.current[type].length > 100) {
          particlesRef.current[type] = particlesRef.current[type].slice(-100);
        }
      });
      
      // Update engine sounds based on truck state - only when accelerating
      if (!muted && truckRef.current) {
        const throttleInput = inputState.forward ? 1 : inputState.reverse ? -1 : 0;
        const isAccelerating = inputState.forward || inputState.reverse;
        const isMoving = Math.abs(truckRef.current.speed) > 0.5;
        
        // Start engine when accelerating
        if (isAccelerating && !audioEngine.engineRunning) {
          audioEngine.startEngine();
        }
        
        // Stop engine when not accelerating and truck has stopped
        if (!isAccelerating && !isMoving && audioEngine.engineRunning) {
          audioEngine.stopEngine();
        }
        
        // Update engine sound if running
        if (audioEngine.engineRunning) {
          audioEngine.updateEngine(truckRef.current.speed, throttleInput, inputState.brake);
        }
        
        // Jake brake when decelerating without throttle
        if (Math.abs(truckRef.current.speed) > 30 && !inputState.forward && !inputState.reverse && !inputState.brake) {
          if (Math.random() < 0.02) { // Occasional jake brake sound
            audioEngine.playJakeBrake(0.5);
          }
        }
      }
      
      // Spotter voice and alignment beeps when near dock
      if (!muted && truckRef.current) {
        const alignment = checkDockAlignment();
        const rearX = truckRef.current.x - Math.cos(truckRef.current.angle) * (TRUCK_LENGTH / 2);
        const rearY = truckRef.current.y - Math.sin(truckRef.current.angle) * (TRUCK_LENGTH / 2);
        const distToDock = Math.sqrt(Math.pow(rearX - levelConfig.dock.x, 2) + Math.pow(rearY - levelConfig.dock.y, 2));
        
        // Alignment beeps when close to dock
        if (distToDock < 150 && Math.abs(truckRef.current.speed) > 2) {
          const alignmentScore = Math.max(0, 1 - alignment.error / 20);
          audioEngine.playAlignmentBeep(alignmentScore);
        }
        
      }
      
      // Check collisions - ANY collision is instant failure
      if (checkCollisionsWithObstacles()) {
        setCollisions(prev => {
          const newCollisions = prev + 1;
          
          // Screen reader announcement (first frame only)
          if (!collisionHandledRef.current) {
            announceToScreenReader('Collision! Level failed.');
          }
          
          // Haptic feedback for mobile
          triggerHaptic('collision');
          
          // Dynamic crash effects - cascade every frame for dramatic feel
          if (!muted) audioEngine.playCollision(1);
          setShowCollisionFlash(true);
          
          // Trigger slow motion effect (if not reduced motion)
          if (!accessibility.reducedMotion) {
            setSlowMotion(true);
            setTimeout(() => setSlowMotion(false), 400);
          }
          
          // Screen shake and particles (respect reduced motion and intensity setting)
          if (!accessibility.reducedMotion && cameraShakeIntensity > 0) {
            const shakeAmount = 12 * cameraShakeIntensity;
            setScreenShake({ 
              x: (Math.random() - 0.5) * shakeAmount, 
              y: (Math.random() - 0.5) * shakeAmount 
            });
            
            // Spawn sparks and debris at collision point
            if (truckRef.current) {
              for (let i = 0; i < 15; i++) {
                particlesRef.current.sparks.push(ParticleSystem.createSparkParticle(truckRef.current.x, truckRef.current.y));
              }
              for (let i = 0; i < 8; i++) {
                particlesRef.current.debris.push(ParticleSystem.createDebrisParticle(truckRef.current.x, truckRef.current.y));
              }
            }
          }
          
          // === GUARDED: queue failure timeout only ONCE ===
          if (!collisionHandledRef.current) {
            collisionHandledRef.current = true;
          
            // Instant failure on ANY collision (extended delay for slow-mo)
            setTimeout(() => {
              if (!muted) audioEngine.playFailure();
              audioEngine.stopEngine();
              setFailReason('collision');
              setShowConfetti(false);
              setShowFailureEffect(true);
              setTimeout(() => setShowFailureEffect(false), 3000);
              setGameState('failed');
            }, accessibility.reducedMotion ? 300 : 500);
          
            setTimeout(() => {
              setShowCollisionFlash(false);
              if (!accessibility.reducedMotion && cameraShakeIntensity > 0) {
                setScreenShake({ x: 0, y: 0 });
              }
            }, 150);
          }
          
          return newCollisions;
        });
        setTruck(prev => prev ? { ...prev, speed: 0 } : prev);
      } else {
        // Check for near misses (close calls)
        const now = Date.now();
        if (checkNearMiss() && now - lastNearMissRef.current > 1500) {
          lastNearMissRef.current = now;
          if (!muted) audioEngine.playNearMiss();
        }
      }
      
      // Check dock alignment
      const alignment = checkDockAlignment();
      if (alignment.aligned && Math.abs(truckRef.current?.speed || 0) < 5) {
        // Start dock lock animation - animate from 0 to 1 over 800ms
        const animStart = Date.now();
        const animateDockLock = () => {
          const elapsed = Date.now() - animStart;
          const progress = Math.min(1, elapsed / 800);
          dockLockAnimationRef.current = progress; // Write to ref, canvas reads it directly
          if (progress < 1) {
            requestAnimationFrame(animateDockLock);
          }
        };
        animateDockLock();
        
        setAirBrakeAnimation(true);
        if (!muted) {
          audioEngine.playDockLock();
          audioEngine.playAirBrake();
        }
        
        setTimeout(() => {
          const timeElapsed = (Date.now() - startTime) / 1000;
          const timeOver = levelConfig.timeLimit ? timeElapsed - levelConfig.timeLimit : 0;
          
          const finalScore = calculateScore(
            collisionsRef.current,
            timeOver,
            alignment.error,
            alignment.distance,
            levelConfig.timeLimit || 60,
            timeElapsed,
            alignment.perfect,
            collisionsRef.current === 0,
            attemptsRef.current === 1,
            pullUpsRef.current
          );
          
          setScore(finalScore);
          
          // Calculate stars earned
          const starsEarned = calculateStars(finalScore);
          
          // Play appropriate star sound based on score
          if (!muted) {
            audioEngine.playStarEarned(starsEarned);
            if (alignment.perfect) {
              setTimeout(() => audioEngine.playSpotterVoice('perfect'), 500);
            } else {
              setTimeout(() => audioEngine.playSpotterVoice('good_job'), 500);
            }
          }
          
          // Check if this is a first completion or improvement
          const isFirstCompletion = currentLevelRef.current !== 'endless' && !highScores[currentLevelRef.current];
          const previousStars = levelStars[currentLevelRef.current] || 0;
          const newStars = Math.max(previousStars, starsEarned);
          const starsGained = newStars - previousStars;
          
          // Update level stars
          if (currentLevelRef.current !== 'endless' && starsEarned > previousStars) {
            setLevelStars(prev => ({
              ...prev,
              [currentLevelRef.current]: starsEarned
            }));
          }
          
          // Update best time
          if (currentLevelRef.current !== 'endless') {
            setLevelTimes(prev => ({
              ...prev,
              [currentLevelRef.current]: Math.min(prev[currentLevelRef.current] || Infinity, timeElapsed)
            }));
          }
          
          // Update stats with extended tracking
          const newStats = {
            ...stats,
            totalAttempts: stats.totalAttempts + 1,
            successfulDocks: stats.successfulDocks + 1,
            perfectDocks: finalScore >= 95 ? stats.perfectDocks + 1 : stats.perfectDocks,
            totalCollisions: stats.totalCollisions + collisionsRef.current,
            bestEndlessStreak: currentLevelRef.current === 'endless' 
              ? Math.max(stats.bestEndlessStreak, endlessStreak + 1)
              : stats.bestEndlessStreak,
            totalXP: stats.totalXP, // Will be updated below
            totalStars: stats.totalStars + starsGained,
            nightLevelsCompleted: levelConfig.nightMode 
              ? stats.nightLevelsCompleted + (isFirstCompletion ? 1 : 0)
              : stats.nightLevelsCompleted,
            // Extended stats
            totalScoreSum: (stats.totalScoreSum || 0) + finalScore,
            gamesPlayedCount: (stats.gamesPlayedCount || 0) + 1,
            averageScore: Math.round(((stats.totalScoreSum || 0) + finalScore) / ((stats.gamesPlayedCount || 0) + 1)),
            lastPlayDate: Date.now(),
            firstPlayDate: stats.firstPlayDate || Date.now(),
            dailyChallengesCompleted: stats.dailyChallengesCompleted || 0,
            levelCompletions: {
              ...stats.levelCompletions,
              [currentLevelRef.current]: ((stats.levelCompletions || {})[currentLevelRef.current] || 0) + 1
            },
            modeCompletions: {
              ...stats.modeCompletions,
              [gameModeRef.current]: ((stats.modeCompletions || {})[gameModeRef.current] || 0) + 1
            },
          };
          
          // Check for fastest dock record
          if (!stats.fastestDock || timeElapsed < stats.fastestDock.time) {
            newStats.fastestDock = { level: currentLevelRef.current, time: timeElapsed, date: Date.now() };
          }
          
          // Calculate attempt multiplier for rewards
          const attemptMultiplier = getAttemptMultiplier(attemptsRef.current);
          
          // Apply attempt penalty to score for display (actual score stays the same for records)
          const adjustedScore = Math.round(finalScore * attemptMultiplier);
          
          // Calculate XP earned (with attempt penalty)
          let xpEarned = currentLevelRef.current !== 'endless'
            ? calculateXPEarned(currentLevelRef.current, finalScore, timeElapsed, pullUpsRef.current, collisionsRef.current, isFirstCompletion, attemptsRef.current)
            : Math.round((15 + (endlessStreak * 5)) * attemptMultiplier); // Endless mode XP with penalty
          
          // Check for customization unlocks
          checkCustomizationUnlocks(newStats, currentLevelRef.current, finalScore);
          
          if (currentLevelRef.current !== 'endless') {
            setHighScores(prev => ({
              ...prev,
              [currentLevelRef.current]: Math.max(prev[currentLevelRef.current] || 0, finalScore)
            }));
            
          }
          
          if (currentLevelRef.current !== 'endless' && finalScore >= levelConfig.targetScore) {
            const nextLevel = currentLevelRef.current + 1;
            if (nextLevel <= 8 && !unlockedLevels.includes(nextLevel)) {
              setUnlockedLevels(prev => [...prev, nextLevel]);
            }
          }
          
          if (currentLevelRef.current === 'endless') {
            setEndlessStreak(prev => prev + 1);
          }
          
          audioEngine.stopEngine();
          
          // Report result to parent when running embedded in App.jsx
          if (embedded) {
            onComplete?.({
              passed:     finalScore >= (levelConfig.targetScore || 60),
              score:      finalScore,
              stars:      starsEarned,
              pullUps:    pullUpsRef.current,
              collisions: collisionsRef.current,
              attempts:   attemptsRef.current,
              time:       Math.round(timeElapsed),
            });
          }
          
          // Screen reader announcement
          announceToScreenReader(`Level complete! Score: ${finalScore}. ${starsEarned === 3 ? 'Perfect! 3 stars!' : starsEarned === 2 ? 'Great! 2 stars!' : '1 star earned.'}`);
          
          // Trigger confetti (respect reduced motion)
          if (!accessibility.reducedMotion) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4000);
          }
          
          setGameState('success');
        }, 800);
        
        return;
      }
      
      // Update timer — calculate fresh from Date.now(), only setState when display value changes
      if (levelConfig.timeLimit && startTime) {
        const newTime = levelConfig.timeLimit - (Date.now() - startTime) / 1000;
        const clamped = Math.max(0, newTime);
        // Only push to React state when the displayed second changes (avoids 60fps setState)
        if (Math.ceil(clamped) !== Math.ceil(timeRemainingRef.current || Infinity)) {
          setTimeRemaining(clamped);
        }
        timeRemainingRef.current = clamped;
        
        if (newTime <= 0 && !collisionHandledRef.current) {
          if (!muted) audioEngine.playFailure();
          audioEngine.stopEngine();
          announceToScreenReader('Time is up. Level failed.');
          setFailReason('timeout');
          setShowConfetti(false);
          setShowFailureEffect(true);
          setTimeout(() => setShowFailureEffect(false), 3000);
          setGameState('failed');
          return;
        }
      }
      
      // Check pull-ups limit
      if (!collisionHandledRef.current) {
        const maxPullUps = getMaxPullUps(currentLevelRef.current);
        if (pullUpsRef.current > maxPullUps) {
          if (!muted) audioEngine.playFailure();
          audioEngine.stopEngine();
          announceToScreenReader('Too many pull-ups! Level failed.');
          setFailReason('pullups');
          setShowConfetti(false);
          setShowFailureEffect(true);
          setTimeout(() => setShowFailureEffect(false), 3000);
          setGameState('failed');
          return;
        }
      }
      
      requestRef.current = requestAnimationFrame(gameLoop);
    };
    
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(requestRef.current);
  // PERF: Only include deps that legitimately require a new game loop instance.
  // Per-frame data (truck, aiTruck, movingObstacles, input, timeRemaining, pullUps,
  // collisions, wheelAngle, pedalState, dpadState, joystickData) are now refs — NOT deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, muted, levelConfig, checkCollisionsWithObstacles, checkNearMiss, checkDockAlignment, checkCustomizationUnlocks, startTime, attempts, currentLevel, unlockedLevels, endlessStreak, steerSensitivity, useTouch, mobileControlType, highScores, levelStars, announceToScreenReader, triggerHaptic, accessibility, gameMode]);

  // Canvas rendering - using refs for smooth animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const render = () => {
      const currentTruck = truckRef.current;
      const currentAiTruck = aiTruckRef.current;
      const shake = screenShakeRef.current;
      
      // Performance mode: skip expensive effects
      const perfMode = accessibility.performanceMode || accessibility.reducedMotion;
      
      ctx.save();
      
      // Apply screen shake (skip in performance mode)
      if (!perfMode) {
        ctx.translate(shake.x, shake.y);
      }
      
      // Apply camera transforms
      const smoothing = perfMode ? 0.2 : 0.08; // Faster camera in perf mode
      
      // Smooth camera transitions
      cameraSmoothRef.current.zoom += (cameraZoom - cameraSmoothRef.current.zoom) * smoothing;
      
      // Apply zoom (scale from center)
      const zoom = cameraSmoothRef.current.zoom;
      if (zoom !== 1) {
        ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);
      }
      
      
      // Draw ground
      drawGround(ctx);
      
      // Draw tire marks
      drawTireMarks(ctx);
      
      // Draw dock
      drawDock(ctx);
      
      // Draw dock worker guide
      if (!accessibility.reducedMotion) {
        const alignment = checkDockAlignment();
        drawDockWorker(ctx, levelConfig.dock, alignment, Date.now() / 1000);
      }
      
      // Draw obstacles
      drawObstacles(ctx);
      
      // Draw guidelines
      if (levelConfig.guidelines && currentTruck) {
        drawGuidelines(ctx);
      }
      
      // Draw AI truck
      if (currentAiTruck) {
        drawTruck(ctx, currentAiTruck, currentAiTruck.color || '#dc2626', true);
      }
      
      // Draw exhaust and tire dust particles (behind truck)
      ParticleSystem.renderParticles(ctx, {
        exhaust: particlesRef.current.exhaust,
        tireDust: particlesRef.current.tireDust,
        sparks: [],
        debris: [],
        rainSplash: particlesRef.current.rainSplash
      });
      
      // Draw motion blur lines when moving fast
      if (currentTruck && Math.abs(currentTruck.speed) > 40) {
        const speed = Math.abs(currentTruck.speed);
        const intensity = Math.min(1, (speed - 40) / 60);
        const lineCount = Math.floor(intensity * 6) + 2;
        
        ctx.save();
        ctx.translate(currentTruck.x, currentTruck.y);
        ctx.rotate(currentTruck.angle);
        
        // Draw speed lines behind the truck
        const direction = currentTruck.speed > 0 ? -1 : 1;
        
        for (let i = 0; i < lineCount; i++) {
          const yOffset = (i - lineCount / 2) * 8;
          const lineLength = 20 + intensity * 40 + Math.random() * 20;
          const startX = direction * (TRUCK_LENGTH / 2 + 5);
          
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.15})`;
          ctx.lineWidth = 2;
          ctx.moveTo(startX, yOffset);
          ctx.lineTo(startX + direction * lineLength, yOffset);
          ctx.stroke();
        }
        
        ctx.restore();
      }
      
      // Draw player truck with customization
      if (currentTruck) {
        const customColor = TRUCK_COLORS[truckCustomization.color] || TRUCK_COLORS.blue;
        drawTruck(ctx, currentTruck, customColor.primary, false, truckCustomization);
        
        // Heat shimmer effect from exhaust when throttle is applied
        if (Math.abs(currentTruck.speed) > 10) {
          const intensity = Math.min(1, Math.abs(currentTruck.speed) / 80);
          ParticleSystem.renderHeatShimmer(ctx, currentTruck.x, currentTruck.y, currentTruck.angle, intensity);
        }
      }
      
      // Draw sparks and debris (on top of truck)
      ParticleSystem.renderParticles(ctx, {
        exhaust: [],
        tireDust: [],
        sparks: particlesRef.current.sparks,
        debris: particlesRef.current.debris,
        rainSplash: []
      });
      
      // Night mode overlay (show headlights when dark)
      const isDarkConditions = levelConfig.nightMode || timeOfDay === 'night' || timeOfDay === 'dusk' || timeOfDay === 'dawn';
      if (isDarkConditions && currentTruck) {
        drawNightOverlay(ctx);
      }
      
      // Fog mode overlay
      if (levelConfig.fogEnabled && currentTruck) {
        drawFogOverlay(ctx);
      }
      
      // Snow effects
      drawWeatherEffects(ctx);
      
      // Time of day lighting
      drawTimeOfDayLighting(ctx);
      
      // Environment-specific decorations
      drawEnvironmentDecorations(ctx);
      
      // Vignette effect (subtle darkening around edges)
      const vignetteIntensity = isDarkConditions ? 0.6 : levelConfig.fogEnabled ? 0.4 : currentWeather === 'snow' ? 0.35 : 0.3;
      const vignetteGrad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.3,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.8
      );
      vignetteGrad.addColorStop(0, 'transparent');
      vignetteGrad.addColorStop(0.5, 'transparent');
      vignetteGrad.addColorStop(1, `rgba(0, 0, 0, ${vignetteIntensity})`);
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Draw HUD
      drawHUD(ctx);
      
      // Collision flash
      if (showCollisionFlashRef.current) {
        ctx.fillStyle = THEME.warningGlow;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      
      // Dock lock animation
      if (dockLockAnimationRef.current > 0) {
        drawDockLockAnimation(ctx);
      }
      
      ctx.restore();
      
      
      if (gameState === 'playing') {
        renderRef.current = requestAnimationFrame(render);
      }
    };
    
    render();
    
    return () => {
      if (renderRef.current) cancelAnimationFrame(renderRef.current);
    };
  }, [gameState, levelConfig]);

  // Drawing functions
  const drawGround = (ctx) => {
    // Base asphalt gradient
    const asphaltGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    asphaltGrad.addColorStop(0, '#0a0a0c');
    asphaltGrad.addColorStop(0.3, THEME.asphaltDark);
    asphaltGrad.addColorStop(1, '#121215');
    ctx.fillStyle = asphaltGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Asphalt aggregate texture (small dots)
    ctx.fillStyle = '#1a1a1e';
    for (let i = 0; i < 800; i++) {
      const x = (i * 37) % CANVAS_WIDTH;
      const y = (i * 23) % CANVAS_HEIGHT;
      ctx.globalAlpha = 0.15 + (i % 5) * 0.05;
      ctx.beginPath();
      ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Oil stains and wear marks
    const wearPatterns = [
      { x: 200, y: 350, w: 120, h: 40, rot: 0.1 },
      { x: 500, y: 420, w: 80, h: 30, rot: -0.05 },
      { x: 350, y: 280, w: 60, h: 25, rot: 0.15 },
      { x: 600, y: 380, w: 100, h: 35, rot: 0 },
      { x: 150, y: 450, w: 90, h: 28, rot: -0.1 },
    ];
    
    wearPatterns.forEach(pattern => {
      ctx.save();
      ctx.translate(pattern.x, pattern.y);
      ctx.rotate(pattern.rot);
      
      const wearGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, pattern.w / 2);
      wearGrad.addColorStop(0, 'rgba(35, 35, 40, 0.4)');
      wearGrad.addColorStop(0.6, 'rgba(30, 30, 35, 0.2)');
      wearGrad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = wearGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, pattern.w / 2, pattern.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    
    // Concrete loading area at top
    const concreteGrad = ctx.createLinearGradient(0, 0, 0, 120);
    concreteGrad.addColorStop(0, THEME.concrete);
    concreteGrad.addColorStop(0.8, THEME.concreteLight);
    concreteGrad.addColorStop(1, THEME.asphaltMid);
    ctx.fillStyle = concreteGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 120);
    
    // Concrete texture lines
    ctx.strokeStyle = 'rgba(80, 80, 85, 0.3)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 120);
      ctx.stroke();
    }
    
    // Concrete edge shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 115, CANVAS_WIDTH, 8);
    
    // Lane markings with glow
    ctx.strokeStyle = THEME.lineWhite;
    ctx.lineWidth = 3;
    ctx.shadowColor = THEME.lineWhiteGlow;
    ctx.shadowBlur = 6;
    ctx.setLineDash([30, 20]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 180);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    
    // Yellow safety zone lines
    ctx.strokeStyle = THEME.lineYellow;
    ctx.lineWidth = 5;
    ctx.shadowColor = THEME.lineYellowGlow;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(40, CANVAS_HEIGHT - 25);
    ctx.lineTo(CANVAS_WIDTH - 40, CANVAS_HEIGHT - 25);
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Hazard stripes on edges
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, CANVAS_HEIGHT - 20, CANVAS_WIDTH, 20);
    ctx.clip();
    
    ctx.fillStyle = THEME.lineYellow;
    for (let x = -20; x < CANVAS_WIDTH + 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, CANVAS_HEIGHT);
      ctx.lineTo(x + 20, CANVAS_HEIGHT);
      ctx.lineTo(x + 40, CANVAS_HEIGHT - 20);
      ctx.lineTo(x + 20, CANVAS_HEIGHT - 20);
      ctx.closePath();
      ctx.globalAlpha = 0.15;
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    
    // Drain grates
    [[100, 300], [700, 450], [400, 500]].forEach(([x, y]) => {
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(x - 15, y - 15, 30, 30);
      ctx.strokeStyle = '#2a2a2e';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 12, y - 12 + i * 6);
        ctx.lineTo(x + 12, y - 12 + i * 6);
        ctx.stroke();
      }
    });
  };

  const drawTireMarks = (ctx) => {
    const marks = tireMarksRef.current;
    
    // Draw path marks first (lighter, dotted pattern)
    marks.filter(m => m.isPath).forEach((mark, i, arr) => {
      const fade = 0.3 + (i / arr.length) * 0.7; // Newer marks more visible
      ctx.save();
      ctx.translate(mark.x, mark.y);
      ctx.rotate(mark.angle);
      ctx.fillStyle = 'rgba(80, 80, 90, 0.6)';
      ctx.globalAlpha = mark.opacity * fade;
      // Small dots for each tire
      ctx.beginPath();
      ctx.arc(-2, -mark.width / 2 + 2, 2, 0, Math.PI * 2);
      ctx.arc(-2, mark.width / 2 - 2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    
    // Draw skid marks (darker, solid)
    marks.filter(m => !m.isPath).forEach((mark, i, arr) => {
      const fade = 0.5 + (i / arr.length) * 0.5;
      ctx.save();
      ctx.translate(mark.x, mark.y);
      ctx.rotate(mark.angle);
      ctx.fillStyle = THEME.tireMarkDark;
      ctx.globalAlpha = mark.opacity * fade;
      ctx.fillRect(-6, -mark.width / 2, 12, 5);
      ctx.fillRect(-6, mark.width / 2 - 5, 12, 5);
      ctx.restore();
    });
    
    ctx.globalAlpha = 1;
  };

  const drawDock = (ctx) => {
    const dock = levelConfig.dock;
    const alignment = checkDockAlignment();
    const dockWidth = dock.width;
    const dockDepth = 55;
    
    ctx.save();
    ctx.translate(dock.x, dock.y);
    ctx.rotate(dock.angle);
    
    // Dock bay shadow (deeper for 3D effect)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(-dockWidth / 2 + 8, -dockDepth + 8, dockWidth, dockDepth);
    
    // Dock bay interior (dark void)
    const bayGrad = ctx.createLinearGradient(0, -dockDepth, 0, -10);
    bayGrad.addColorStop(0, '#0a0a0c');
    bayGrad.addColorStop(0.5, '#151518');
    bayGrad.addColorStop(1, '#1a1a1e');
    ctx.fillStyle = bayGrad;
    ctx.fillRect(-dockWidth / 2, -dockDepth, dockWidth, dockDepth - 5);
    
    // Dock platform (loading edge)
    const platformGrad = ctx.createLinearGradient(0, -8, 0, 8);
    platformGrad.addColorStop(0, THEME.dockPlatformLight);
    platformGrad.addColorStop(0.5, THEME.dockPlatform);
    platformGrad.addColorStop(1, THEME.dockPlatformEdge);
    ctx.fillStyle = platformGrad;
    ctx.fillRect(-dockWidth / 2 - 8, -8, dockWidth + 16, 16);
    
    // Metal edge strip
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(-dockWidth / 2 - 8, -2, dockWidth + 16, 4);
    
    // Highlight on metal edge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(-dockWidth / 2 - 8, -2, dockWidth + 16, 1);
    
    // Rubber bumpers with realistic texture
    const bumperPositions = [-dockWidth / 2 - 5, dockWidth / 2 - 7];
    bumperPositions.forEach(bx => {
      // Bumper shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(bx + 3, -12 + 3, 14, 24);
      
      // Bumper base
      ctx.fillStyle = '#1a1a1e';
      ctx.fillRect(bx, -12, 14, 24);
      
      // Yellow warning stripes
      ctx.fillStyle = THEME.rubberBumperStripe;
      ctx.fillRect(bx + 2, -10, 10, 4);
      ctx.fillRect(bx + 2, -2, 10, 4);
      ctx.fillRect(bx + 2, 6, 10, 4);
      
      // Rubber texture lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(bx + 4 + i * 3, -12);
        ctx.lineTo(bx + 4 + i * 3, 12);
        ctx.stroke();
      }
    });
    
    // Dock guidelines (yellow lines extending out)
    ctx.strokeStyle = THEME.lineYellow;
    ctx.lineWidth = 4;
    ctx.shadowColor = THEME.lineYellowGlow;
    ctx.shadowBlur = 6;
    
    // Solid lines near dock
    ctx.beginPath();
    ctx.moveTo(-dockWidth / 2, 8);
    ctx.lineTo(-dockWidth / 2, 100);
    ctx.moveTo(dockWidth / 2, 8);
    ctx.lineTo(dockWidth / 2, 100);
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Target zone chevrons
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = 20 + i * 18;
      ctx.beginPath();
      ctx.moveTo(-dockWidth / 2 + 5, y);
      ctx.lineTo(0, y + 8);
      ctx.lineTo(dockWidth / 2 - 5, y);
      ctx.stroke();
    }
    
    // Dock lights (mounted on posts)
    const lightPhase = Math.sin(dockLightRef.current * 4);
    const isAligned = alignment.aligned;
    
    const lightPositions = [
      { x: -dockWidth / 2 - 18, side: 0 },
      { x: dockWidth / 2 + 18, side: 1 }
    ];
    
    lightPositions.forEach(({ x, side }) => {
      // Light post
      ctx.fillStyle = '#374151';
      ctx.fillRect(x - 3, -dockDepth + 5, 6, dockDepth - 10);
      
      // Light housing
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.roundRect(x - 8, -dockDepth / 2 - 10, 16, 20, 3);
      ctx.fill();
      
      // Light lens
      const lightOn = isAligned || (lightPhase > 0 ? side === 0 : side === 1);
      const lightColor = isAligned ? THEME.dockLightGreen : THEME.dockLightRed;
      
      if (lightOn) {
        // Outer glow
        const glowGrad = ctx.createRadialGradient(x, -dockDepth / 2, 0, x, -dockDepth / 2, 30);
        glowGrad.addColorStop(0, isAligned ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.4)');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, -dockDepth / 2, 30, 0, Math.PI * 2);
        ctx.fill();
        
        // Light core
        ctx.fillStyle = lightColor;
        ctx.shadowColor = lightColor;
        ctx.shadowBlur = 20;
      } else {
        ctx.fillStyle = '#374151';
        ctx.shadowBlur = 0;
      }
      
      ctx.beginPath();
      ctx.arc(x, -dockDepth / 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Light lens reflection
      if (lightOn) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(x - 2, -dockDepth / 2 - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    // Success zone ambient glow
    if (isAligned) {
      const successGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, dockWidth);
      successGrad.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
      successGrad.addColorStop(0.5, 'rgba(34, 197, 94, 0.1)');
      successGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = successGrad;
      ctx.beginPath();
      ctx.arc(0, 0, dockWidth, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // "DOCK" text stencil
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DOCK', 0, -dockDepth + 20);
    
    ctx.restore();
  };

  // Draw animated dock worker guide
  const drawDockWorker = (ctx, dock, alignment, time) => {
    const workerX = dock.x + dock.width / 2 + 40;
    const workerY = dock.y + 30;
    
    ctx.save();
    ctx.translate(workerX, workerY);
    
    // Bobbing animation
    const bobOffset = Math.sin(time * 3) * 2;
    
    // Worker body
    ctx.fillStyle = '#f97316'; // Safety orange vest
    ctx.beginPath();
    ctx.ellipse(0, bobOffset, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Reflective stripes on vest
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-7, bobOffset - 4, 14, 2);
    ctx.fillRect(-7, bobOffset + 2, 14, 2);
    
    // Head
    ctx.fillStyle = '#fcd34d'; // Hard hat
    ctx.beginPath();
    ctx.arc(0, bobOffset - 16, 7, 0, Math.PI * 2);
    ctx.fill();
    
    // Face
    ctx.fillStyle = '#d4a574';
    ctx.beginPath();
    ctx.arc(0, bobOffset - 14, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Arms animation based on alignment
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    if (alignment.aligned) {
      // Both arms up - STOP signal
      ctx.beginPath();
      ctx.moveTo(-6, bobOffset - 4);
      ctx.lineTo(-12, bobOffset - 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, bobOffset - 4);
      ctx.lineTo(12, bobOffset - 20);
      ctx.stroke();
      
      // Thumbs up hands
      ctx.fillStyle = '#d4a574';
      ctx.beginPath();
      ctx.arc(-12, bobOffset - 22, 3, 0, Math.PI * 2);
      ctx.arc(12, bobOffset - 22, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (alignment.distance < 100) {
      // Guiding gesture - wave back
      const waveAngle = Math.sin(time * 8) * 0.3;
      ctx.beginPath();
      ctx.moveTo(-6, bobOffset - 4);
      ctx.lineTo(-10 + Math.sin(waveAngle) * 4, bobOffset - 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, bobOffset - 4);
      ctx.lineTo(10 + Math.cos(time * 6) * 8, bobOffset - 15 + Math.sin(time * 6) * 3);
      ctx.stroke();
    } else {
      // Idle arms
      ctx.beginPath();
      ctx.moveTo(-6, bobOffset - 4);
      ctx.lineTo(-10, bobOffset + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, bobOffset - 4);
      ctx.lineTo(10, bobOffset + 4);
      ctx.stroke();
    }
    
    // Legs
    ctx.strokeStyle = '#1e3a5f'; // Dark blue pants
    ctx.lineWidth = 4;
    const legWobble = Math.sin(time * 2) * 1;
    ctx.beginPath();
    ctx.moveTo(-3, bobOffset + 10);
    ctx.lineTo(-4 + legWobble, bobOffset + 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, bobOffset + 10);
    ctx.lineTo(4 - legWobble, bobOffset + 22);
    ctx.stroke();
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, bobOffset + 24, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  };

  const drawTruck = (ctx, truckData, cabColor, isAI = false, customization = null) => {
    ctx.save();
    ctx.translate(truckData.x, truckData.y);
    ctx.rotate(truckData.angle);
    // Flip truck so cab faces the direction of travel (forward = +X)
    ctx.rotate(Math.PI);
    
    // Get customization settings
    const custom = customization || {};
    const colorConfig = TRUCK_COLORS[custom.color] || { primary: cabColor, secondary: cabColor };
    const boxConfig = BOX_STYLES[custom.boxStyle] || BOX_STYLES.ribbed;
    const decalConfig = DECALS[custom.decal] || DECALS.none;
    const accessories = custom.accessories || [];
    
    // Apply body roll (visual tilt from turning)
    const rollOffset = (truckData.bodyRoll || 0) * 40;
    const rollScale = 1 - Math.abs(truckData.bodyRoll || 0) * 2;
    
    // Apply body pitch (forward/back tilt from accel/brake)
    const pitchOffset = (truckData.bodyPitch || 0) * 25;
    
    // Suspension compression affects wheel positions
    const suspFL = truckData.suspensionFL || 0;
    const suspFR = truckData.suspensionFR || 0;
    const suspRL = truckData.suspensionRL || 0;
    const suspRR = truckData.suspensionRR || 0;
    
    // Calculate body tilt from suspension difference
    const frontSuspAvg = (suspFL + suspFR) / 2;
    const rearSuspAvg = (suspRL + suspRR) / 2;
    const suspPitchEffect = (frontSuspAvg - rearSuspAvg) * 15;
    
    // Dynamic shadow based on time of day
    const isNight = levelConfig?.nightMode || false;
    const shadowOffsetX = isNight ? 12 : 8; // Night: longer shadows from overhead lights
    const shadowOffsetY = isNight ? 12 : 8;
    const shadowBlur = isNight ? 8 : 4;
    const shadowOpacity = isNight ? 0.5 : 0.35;
    
    // Main shadow (soft, offset) - shadow moves with body tilt
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
    ctx.filter = `blur(${shadowBlur}px)`;
    ctx.beginPath();
    ctx.roundRect(-TRUCK_LENGTH / 2 + shadowOffsetX, -TRUCK_WIDTH / 2 + shadowOffsetY + rollOffset, TRUCK_LENGTH, TRUCK_WIDTH * rollScale, 4);
    ctx.fill();
    ctx.filter = 'none';
    
    // Hard shadow (sharp, close) - reduced in night mode
    ctx.fillStyle = `rgba(0, 0, 0, ${isNight ? 0.3 : 0.5})`;
    ctx.beginPath();
    ctx.roundRect(-TRUCK_LENGTH / 2 + 4, -TRUCK_WIDTH / 2 + 4 + rollOffset, TRUCK_LENGTH, TRUCK_WIDTH * rollScale, 4);
    ctx.fill();
    
    // === BOX BODY ===
    const boxStartX = -TRUCK_LENGTH / 2 + CAB_LENGTH - 2;
    const boxWidth = TRUCK_LENGTH - CAB_LENGTH + 2;
    const boxHeight = TRUCK_WIDTH * rollScale;
    const boxY = -TRUCK_WIDTH / 2 + rollOffset + (1 - rollScale) * TRUCK_WIDTH / 2;
    
    // Box base with pitch effect
    ctx.save();
    ctx.translate(0, pitchOffset + suspPitchEffect);
    
    // Box body gradient (white/gray trailer)
    const boxGrad = ctx.createLinearGradient(0, boxY, 0, boxY + boxHeight);
    boxGrad.addColorStop(0, '#f8f8fa');
    boxGrad.addColorStop(0.15, '#f0f0f2');
    boxGrad.addColorStop(0.5, '#e0e0e4');
    boxGrad.addColorStop(0.85, '#f0f0f2');
    boxGrad.addColorStop(1, '#f8f8fa');
    ctx.fillStyle = boxGrad;
    ctx.beginPath();
    ctx.roundRect(boxStartX, boxY, boxWidth, boxHeight, [0, 3, 3, 0]);
    ctx.fill();
    
    // Box panel lines (ribbed style)
    if (boxConfig.ribs || boxConfig.id === 'ribbed') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      const ribCount = boxConfig.ribs || 4;
      const panelWidth = boxWidth / ribCount;
      for (let i = 1; i < ribCount; i++) {
        ctx.beginPath();
        ctx.moveTo(boxStartX + i * panelWidth, boxY);
        ctx.lineTo(boxStartX + i * panelWidth, boxY + boxHeight);
        ctx.stroke();
      }
    }
    
    // Box top edge highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boxStartX, boxY + 1);
    ctx.lineTo(boxStartX + boxWidth, boxY + 1);
    ctx.stroke();
    
    // Box bottom edge shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.moveTo(boxStartX, boxY + boxHeight - 1);
    ctx.lineTo(boxStartX + boxWidth, boxY + boxHeight - 1);
    ctx.stroke();
    
    // Box frame border
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxStartX, boxY, boxWidth, boxHeight);
    
    // Box rear door frame
    ctx.fillStyle = '#c0c0c8';
    ctx.fillRect(TRUCK_LENGTH / 2 - 8, boxY + 3, 6, boxHeight - 6);
    
    // Rear door handle
    ctx.fillStyle = '#808088';
    ctx.fillRect(TRUCK_LENGTH / 2 - 6, boxY + boxHeight / 2 - 5, 3, 10);
    
    // === CAB ===
    const cabHeight = TRUCK_WIDTH - 4;
    const cabY = -TRUCK_WIDTH / 2 + 2 + rollOffset;
    
    // Cab body gradient with customization colors
    const cabGrad = ctx.createLinearGradient(0, cabY, 0, cabY + cabHeight * rollScale);
    if (isAI) {
      cabGrad.addColorStop(0, '#ef4444');
      cabGrad.addColorStop(0.3, '#dc2626');
      cabGrad.addColorStop(0.7, '#b91c1c');
      cabGrad.addColorStop(1, '#dc2626');
    } else {
      // Use customization primary and secondary colors
      const primaryColor = colorConfig.primary || '#3b82f6';
      const secondaryColor = colorConfig.secondary || '#2563eb';
      
      // Create darker shade for gradient
      cabGrad.addColorStop(0, primaryColor);
      cabGrad.addColorStop(0.3, secondaryColor);
      cabGrad.addColorStop(0.7, secondaryColor);
      cabGrad.addColorStop(1, primaryColor);
    }
    ctx.fillStyle = cabGrad;
    ctx.beginPath();
    ctx.roundRect(-TRUCK_LENGTH / 2, cabY, CAB_LENGTH + 5, cabHeight * rollScale, [10, 0, 0, 10]);
    ctx.fill();
    
    // === ROOF MARKER LIGHTS (horizontally across the cab width - aerial view) ===
    if (!isAI) {
      const markerX = -TRUCK_LENGTH / 2 + 18; // Position along cab roof
      const markerSpacing = (cabHeight * rollScale - 10) / 4; // Space across cab width
      
      // 5 marker lights across the cab width (left to right)
      for (let i = 0; i < 5; i++) {
        const my = cabY + 5 + i * markerSpacing;
        const isCenter = i === 2;
        
        // Light housing
        ctx.fillStyle = '#2a2a30';
        ctx.beginPath();
        ctx.roundRect(markerX - 2, my - 1.5, 4, 4, 1);
        ctx.fill();
        
        // Light glow
        ctx.fillStyle = isCenter ? '#fbbf24' : '#ef4444'; // Center amber, sides red
        ctx.shadowColor = isCenter ? '#fbbf24' : '#ef4444';
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.roundRect(markerX - 1, my - 0.5, 2, 2, 0.5);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    
    // Decal rendering on cab side
    if (!isAI && decalConfig.pattern && decalConfig.pattern !== 'none') {
      ctx.save();
      ctx.globalAlpha = 0.7;
      
      if (decalConfig.pattern === 'flames') {
        // Hot rod flames across the cab roof (overhead view)
        const flameColor = decalConfig.color || '#f97316';
        const cabFront = -TRUCK_LENGTH / 2;
        const cabBack = -TRUCK_LENGTH / 2 + CAB_LENGTH + 3;
        const ch = cabHeight * rollScale;
        const cTop = cabY;
        
        // 3 flame tongues sweeping from front to back across the cab roof
        // Top flame - hugs upper edge
        ctx.fillStyle = flameColor;
        ctx.beginPath();
        ctx.moveTo(cabFront + 2, cTop + ch * 0.02);
        ctx.lineTo(cabFront + 8, cTop + ch * 0.02);
        ctx.quadraticCurveTo(cabBack - 8, cTop + ch * 0.0, cabBack - 2, cTop + ch * 0.15);
        ctx.quadraticCurveTo(cabBack - 10, cTop + ch * 0.20, cabBack - 16, cTop + ch * 0.28);
        ctx.quadraticCurveTo(cabFront + 14, cTop + ch * 0.32, cabFront + 2, cTop + ch * 0.28);
        ctx.closePath();
        ctx.fill();
        
        // Center flame - largest, goes through middle
        ctx.beginPath();
        ctx.moveTo(cabFront + 2, cTop + ch * 0.32);
        ctx.lineTo(cabFront + 10, cTop + ch * 0.32);
        ctx.quadraticCurveTo(cabBack - 4, cTop + ch * 0.28, cabBack + 2, cTop + ch * 0.48);
        ctx.quadraticCurveTo(cabBack - 4, cTop + ch * 0.58, cabBack - 10, cTop + ch * 0.55);
        ctx.quadraticCurveTo(cabFront + 14, cTop + ch * 0.68, cabFront + 2, cTop + ch * 0.65);
        ctx.closePath();
        ctx.fill();
        
        // Bottom flame - hugs lower edge
        ctx.beginPath();
        ctx.moveTo(cabFront + 2, cTop + ch * 0.70);
        ctx.lineTo(cabFront + 8, cTop + ch * 0.70);
        ctx.quadraticCurveTo(cabBack - 8, cTop + ch * 0.68, cabBack - 2, cTop + ch * 0.82);
        ctx.quadraticCurveTo(cabBack - 10, cTop + ch * 0.80, cabBack - 16, cTop + ch * 0.92);
        ctx.quadraticCurveTo(cabFront + 14, cTop + ch * 0.98, cabFront + 2, cTop + ch * 0.96);
        ctx.closePath();
        ctx.fill();
        
        // Bright inner cores for depth
        ctx.fillStyle = '#fbbf24';
        ctx.globalAlpha = 0.45;
        // Top core
        ctx.beginPath();
        ctx.moveTo(cabFront + 4, cTop + ch * 0.06);
        ctx.quadraticCurveTo(cabFront + 20, cTop + ch * 0.04, cabFront + 22, cTop + ch * 0.14);
        ctx.quadraticCurveTo(cabFront + 16, cTop + ch * 0.22, cabFront + 4, cTop + ch * 0.22);
        ctx.closePath();
        ctx.fill();
        // Center core
        ctx.beginPath();
        ctx.moveTo(cabFront + 4, cTop + ch * 0.38);
        ctx.quadraticCurveTo(cabFront + 22, cTop + ch * 0.34, cabFront + 26, cTop + ch * 0.48);
        ctx.quadraticCurveTo(cabFront + 18, cTop + ch * 0.58, cabFront + 4, cTop + ch * 0.58);
        ctx.closePath();
        ctx.fill();
        // Bottom core
        ctx.beginPath();
        ctx.moveTo(cabFront + 4, cTop + ch * 0.74);
        ctx.quadraticCurveTo(cabFront + 20, cTop + ch * 0.72, cabFront + 22, cTop + ch * 0.82);
        ctx.quadraticCurveTo(cabFront + 16, cTop + ch * 0.90, cabFront + 4, cTop + ch * 0.90);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.7;
      } else if (decalConfig.pattern === 'stripes') {
        // Racing stripes
        ctx.fillStyle = decalConfig.color || '#fff';
        ctx.fillRect(-TRUCK_LENGTH / 2, cabY + cabHeight * rollScale * 0.35, CAB_LENGTH, 3);
        ctx.fillRect(-TRUCK_LENGTH / 2, cabY + cabHeight * rollScale * 0.55, CAB_LENGTH, 3);
      } else if (decalConfig.pattern === 'checkered') {
        // Checkered flag covering entire cab roof
        const cabFront = -TRUCK_LENGTH / 2;
        const cabLen = CAB_LENGTH;
        const ch = cabHeight * rollScale;
        const cTop = cabY;
        const cols = 7;
        const rows = 6;
        const cellW = cabLen / cols;
        const cellH = ch / rows;
        
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if ((r + c) % 2 === 0) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            } else {
              ctx.fillStyle = 'rgba(30, 30, 30, 0.6)';
            }
            ctx.fillRect(cabFront + c * cellW, cTop + r * cellH, cellW, cellH);
          }
        }
      } else if (decalConfig.pattern === 'lightning') {
        // Lightning bolt
        ctx.fillStyle = decalConfig.color || '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-TRUCK_LENGTH / 2 + 5, cabY + 8);
        ctx.lineTo(-TRUCK_LENGTH / 2 + 15, cabY + cabHeight * rollScale * 0.4);
        ctx.lineTo(-TRUCK_LENGTH / 2 + 12, cabY + cabHeight * rollScale * 0.4);
        ctx.lineTo(-TRUCK_LENGTH / 2 + 22, cabY + cabHeight * rollScale - 8);
        ctx.lineTo(-TRUCK_LENGTH / 2 + 18, cabY + cabHeight * rollScale * 0.6);
        ctx.lineTo(-TRUCK_LENGTH / 2 + 21, cabY + cabHeight * rollScale * 0.6);
        ctx.closePath();
        ctx.fill();
      } else if (decalConfig.pattern === 'stars') {
        // Star pattern
        ctx.fillStyle = decalConfig.color || '#fbbf24';
        const drawStar = (cx, cy, r) => {
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        };
        drawStar(-TRUCK_LENGTH / 2 + 10, cabY + cabHeight * rollScale * 0.3, 5);
        drawStar(-TRUCK_LENGTH / 2 + 22, cabY + cabHeight * rollScale * 0.5, 4);
        drawStar(-TRUCK_LENGTH / 2 + 15, cabY + cabHeight * rollScale * 0.7, 3);
      } else if (decalConfig.pattern === 'arrows') {
        // Arrow dynamics
        ctx.fillStyle = decalConfig.color || '#22c55e';
        for (let i = 0; i < 3; i++) {
          const xOff = i * 8;
          ctx.beginPath();
          ctx.moveTo(-TRUCK_LENGTH / 2 + 5 + xOff, cabY + cabHeight * rollScale * 0.5);
          ctx.lineTo(-TRUCK_LENGTH / 2 + 12 + xOff, cabY + cabHeight * rollScale * 0.3);
          ctx.lineTo(-TRUCK_LENGTH / 2 + 12 + xOff, cabY + cabHeight * rollScale * 0.4);
          ctx.lineTo(-TRUCK_LENGTH / 2 + 20 + xOff, cabY + cabHeight * rollScale * 0.4);
          ctx.lineTo(-TRUCK_LENGTH / 2 + 20 + xOff, cabY + cabHeight * rollScale * 0.6);
          ctx.lineTo(-TRUCK_LENGTH / 2 + 12 + xOff, cabY + cabHeight * rollScale * 0.6);
          ctx.lineTo(-TRUCK_LENGTH / 2 + 12 + xOff, cabY + cabHeight * rollScale * 0.7);
          ctx.closePath();
          ctx.fill();
        }
      } else if (decalConfig.pattern === 'tribal') {
        // Tribal swirl
        ctx.strokeStyle = decalConfig.color || '#7c3aed';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-TRUCK_LENGTH / 2 + 5, cabY + cabHeight * rollScale * 0.5);
        ctx.bezierCurveTo(
          -TRUCK_LENGTH / 2 + 15, cabY + cabHeight * rollScale * 0.2,
          -TRUCK_LENGTH / 2 + 25, cabY + cabHeight * rollScale * 0.8,
          -TRUCK_LENGTH / 2 + 30, cabY + cabHeight * rollScale * 0.5
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-TRUCK_LENGTH / 2 + 8, cabY + cabHeight * rollScale * 0.3);
        ctx.bezierCurveTo(
          -TRUCK_LENGTH / 2 + 12, cabY + cabHeight * rollScale * 0.1,
          -TRUCK_LENGTH / 2 + 18, cabY + cabHeight * rollScale * 0.4,
          -TRUCK_LENGTH / 2 + 15, cabY + cabHeight * rollScale * 0.6
        );
        ctx.stroke();
      } else if (decalConfig.pattern === 'hexagon') {
        // Hex grid pattern
        ctx.strokeStyle = decalConfig.color || '#06b6d4';
        ctx.lineWidth = 1;
        const hexSize = 6;
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 3; col++) {
            const cx = -TRUCK_LENGTH / 2 + 10 + col * hexSize * 1.8 + (row % 2) * hexSize * 0.9;
            const cy = cabY + cabHeight * rollScale * 0.35 + row * hexSize * 1.5;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = i * Math.PI / 3;
              const x = cx + Math.cos(angle) * hexSize;
              const y = cy + Math.sin(angle) * hexSize;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
          }
        }
      } else if (decalConfig.pattern === 'retro') {
        // Retro wave / synthwave
        ctx.strokeStyle = decalConfig.color || '#ec4899';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const yOff = i * 5;
          ctx.beginPath();
          ctx.moveTo(-TRUCK_LENGTH / 2 + 3, cabY + cabHeight * rollScale * 0.3 + yOff);
          for (let x = 0; x < 25; x += 5) {
            const waveY = Math.sin(x * 0.5) * 3;
            ctx.lineTo(-TRUCK_LENGTH / 2 + 3 + x, cabY + cabHeight * rollScale * 0.3 + yOff + waveY);
          }
          ctx.stroke();
        }
      }
      
      ctx.restore();
    }
    
    // Cab top highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-TRUCK_LENGTH / 2 + 10, cabY + 1);
    ctx.lineTo(-TRUCK_LENGTH / 2 + CAB_LENGTH, cabY + 1);
    ctx.stroke();
    
    // Accessories: Light bar on roof
    if (!isAI && accessories.includes('lightbar')) {
      ctx.fillStyle = '#374151';
      ctx.fillRect(-TRUCK_LENGTH / 2 + 8, cabY - 4, 20, 4);
      // LED lights
      const time = Date.now() * 0.003;
      for (let i = 0; i < 4; i++) {
        const lightOn = Math.sin(time + i) > 0.3;
        ctx.fillStyle = lightOn ? '#fbbf24' : '#4b5563';
        ctx.fillRect(-TRUCK_LENGTH / 2 + 10 + i * 5, cabY - 3, 3, 2);
      }
    }
    
    // Accessories: Amber Light Bar
    if (!isAI && accessories.includes('lightbar_amber')) {
      ctx.fillStyle = '#374151';
      ctx.fillRect(-TRUCK_LENGTH / 2 + 8, cabY - 4, 20, 4);
      const time = Date.now() * 0.004;
      for (let i = 0; i < 4; i++) {
        const lightOn = Math.sin(time + i * 0.8) > 0.2;
        ctx.fillStyle = lightOn ? '#f59e0b' : '#4b5563';
        ctx.shadowColor = lightOn ? '#f59e0b' : 'transparent';
        ctx.shadowBlur = lightOn ? 4 : 0;
        ctx.fillRect(-TRUCK_LENGTH / 2 + 10 + i * 5, cabY - 3, 3, 2);
      }
      ctx.shadowBlur = 0;
    }
    
    // Accessories: Emergency Lights (police style)
    if (!isAI && accessories.includes('lightbar_police')) {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-TRUCK_LENGTH / 2 + 6, cabY - 5, 24, 5);
      const time = Date.now() * 0.008;
      // Red and blue alternating
      for (let i = 0; i < 4; i++) {
        const phase = Math.sin(time + i * 1.5);
        const isRed = i % 2 === 0;
        const lightOn = isRed ? phase > 0 : phase < 0;
        ctx.fillStyle = lightOn ? (isRed ? '#ef4444' : '#3b82f6') : '#1f2937';
        ctx.shadowColor = lightOn ? (isRed ? '#ef4444' : '#3b82f6') : 'transparent';
        ctx.shadowBlur = lightOn ? 6 : 0;
        ctx.fillRect(-TRUCK_LENGTH / 2 + 8 + i * 5, cabY - 4, 4, 3);
      }
      ctx.shadowBlur = 0;
    }
    
    // Accessories: Roof spoiler
    if (!isAI && accessories.includes('spoiler')) {
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.moveTo(-TRUCK_LENGTH / 2 + CAB_LENGTH - 5, cabY - 3);
      ctx.lineTo(-TRUCK_LENGTH / 2 + CAB_LENGTH + 5, cabY - 6);
      ctx.lineTo(-TRUCK_LENGTH / 2 + CAB_LENGTH + 5, cabY);
      ctx.lineTo(-TRUCK_LENGTH / 2 + CAB_LENGTH - 5, cabY);
      ctx.closePath();
      ctx.fill();
    }
    
    // Accessories: Dual antennas
    if (!isAI && accessories.includes('antenna_dual')) {
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 1;
      // Left antenna
      ctx.beginPath();
      ctx.moveTo(-TRUCK_LENGTH / 2 + 5, cabY - 2);
      ctx.lineTo(-TRUCK_LENGTH / 2 + 3, cabY - 12);
      ctx.stroke();
      // Right antenna
      ctx.beginPath();
      ctx.moveTo(-TRUCK_LENGTH / 2 + CAB_LENGTH - 5, cabY - 2);
      ctx.lineTo(-TRUCK_LENGTH / 2 + CAB_LENGTH - 3, cabY - 12);
      ctx.stroke();
      // Tips
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-TRUCK_LENGTH / 2 + 3, cabY - 12, 1.5, 0, Math.PI * 2);
      ctx.arc(-TRUCK_LENGTH / 2 + CAB_LENGTH - 3, cabY - 12, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Accessories: Whip antenna
    if (!isAI && accessories.includes('antenna_whip')) {
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-TRUCK_LENGTH / 2 + 15, cabY - 2);
      const time = Date.now() * 0.002;
      const sway = Math.sin(time) * 2;
      ctx.quadraticCurveTo(
        -TRUCK_LENGTH / 2 + 15 + sway, cabY - 10,
        -TRUCK_LENGTH / 2 + 15 + sway * 1.5, cabY - 18
      );
      ctx.stroke();
    }
    
    // === WINDSHIELD (larger, more detailed) ===
    const windshieldGrad = ctx.createLinearGradient(-TRUCK_LENGTH / 2, 0, -TRUCK_LENGTH / 2 + 18, 0);
    windshieldGrad.addColorStop(0, '#0f172a');
    windshieldGrad.addColorStop(0.3, '#1e3a5f');
    windshieldGrad.addColorStop(0.7, '#1e293b');
    windshieldGrad.addColorStop(1, '#334155');
    ctx.fillStyle = windshieldGrad;
    
    // Windshield shape (aerodynamic curve)
    ctx.beginPath();
    ctx.moveTo(-TRUCK_LENGTH / 2 + 4, cabY + 6);
    ctx.quadraticCurveTo(-TRUCK_LENGTH / 2 + 2, cabY + 4, -TRUCK_LENGTH / 2 + 6, cabY + 3);
    ctx.lineTo(-TRUCK_LENGTH / 2 + 16, cabY + 3);
    ctx.lineTo(-TRUCK_LENGTH / 2 + 18, cabY + 6);
    ctx.lineTo(-TRUCK_LENGTH / 2 + 18, cabY + cabHeight * rollScale - 6);
    ctx.lineTo(-TRUCK_LENGTH / 2 + 16, cabY + cabHeight * rollScale - 3);
    ctx.lineTo(-TRUCK_LENGTH / 2 + 6, cabY + cabHeight * rollScale - 3);
    ctx.quadraticCurveTo(-TRUCK_LENGTH / 2 + 2, cabY + cabHeight * rollScale - 4, -TRUCK_LENGTH / 2 + 4, cabY + cabHeight * rollScale - 6);
    ctx.closePath();
    ctx.fill();
    
    // Windshield frame
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Windshield reflection (diagonal streak)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(-TRUCK_LENGTH / 2 + 6, cabY + 5);
    ctx.lineTo(-TRUCK_LENGTH / 2 + 12, cabY + 5);
    ctx.lineTo(-TRUCK_LENGTH / 2 + 8, cabY + cabHeight * rollScale - 5);
    ctx.lineTo(-TRUCK_LENGTH / 2 + 5, cabY + cabHeight * rollScale - 5);
    ctx.closePath();
    ctx.fill();
    
    // === SIDE MIRRORS (detailed with arms and glass) ===
    const mirrorColor = accessories.includes('mirrors_chrome') ? '#e5e7eb' : '#1f2937';
    
    // Mirror arms
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-TRUCK_LENGTH / 2 + 18, cabY - 2, 10, 2);
    ctx.fillRect(-TRUCK_LENGTH / 2 + 18, cabY + cabHeight * rollScale, 10, 2);
    
    // Mirror housings
    ctx.fillStyle = mirrorColor;
    ctx.beginPath();
    ctx.roundRect(-TRUCK_LENGTH / 2 + 16, cabY - 7, 10, 6, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-TRUCK_LENGTH / 2 + 16, cabY + cabHeight * rollScale + 1, 10, 6, 2);
    ctx.fill();
    
    // Mirror glass
    ctx.fillStyle = '#374151';
    ctx.fillRect(-TRUCK_LENGTH / 2 + 17, cabY - 6, 8, 4);
    ctx.fillRect(-TRUCK_LENGTH / 2 + 17, cabY + cabHeight * rollScale + 2, 8, 4);
    
    // Mirror glass reflection
    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.fillRect(-TRUCK_LENGTH / 2 + 18, cabY - 5, 3, 2);
    ctx.fillRect(-TRUCK_LENGTH / 2 + 18, cabY + cabHeight * rollScale + 3, 3, 2);
    
    // === FUEL TANKS (between cab and trailer) ===
    if (!isAI) {
      ctx.fillStyle = '#374151';
      // Left fuel tank
      ctx.beginPath();
      ctx.roundRect(-TRUCK_LENGTH / 2 + CAB_LENGTH - 2, cabY - 4, 10, 5, 2);
      ctx.fill();
      // Right fuel tank
      ctx.beginPath();
      ctx.roundRect(-TRUCK_LENGTH / 2 + CAB_LENGTH - 2, cabY + cabHeight * rollScale - 1, 10, 5, 2);
      ctx.fill();
      
      // Fuel cap detail
      ctx.fillStyle = '#4b5563';
      ctx.beginPath();
      ctx.arc(-TRUCK_LENGTH / 2 + CAB_LENGTH + 3, cabY - 1.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-TRUCK_LENGTH / 2 + CAB_LENGTH + 3, cabY + cabHeight * rollScale + 1.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // === SIDE STEPS (cab access) ===
    if (!isAI) {
      ctx.fillStyle = '#4b5563';
      // Left step
      ctx.fillRect(-TRUCK_LENGTH / 2 + CAB_LENGTH - 4, cabY - 2, 6, 3);
      // Right step
      ctx.fillRect(-TRUCK_LENGTH / 2 + CAB_LENGTH - 4, cabY + cabHeight * rollScale - 1, 6, 3);
      
      // Step grip texture
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(-TRUCK_LENGTH / 2 + CAB_LENGTH - 3, cabY - 1, 4, 1);
      ctx.fillRect(-TRUCK_LENGTH / 2 + CAB_LENGTH - 3, cabY + cabHeight * rollScale, 4, 1);
    }
    
    // Chrome grille bars
    ctx.fillStyle = '#d1d5db';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-TRUCK_LENGTH / 2 + 1, cabY + 8 + i * 8, 3, 4);
      ctx.fillRect(-TRUCK_LENGTH / 2 + 1, cabY + cabHeight * rollScale - 12 - i * 8, 3, 4);
    }
    
    // Close the pitch save (body pitch effect)
    ctx.restore();
    
    // === WHEELS (4 total: 2 front, 2 rear) ===
    // Wheel positions adjusted by suspension compression
    const wheelPositions = [
      { x: -TRUCK_LENGTH / 2 + 20, y: -TRUCK_WIDTH / 2 - 3, steer: true, susp: suspFL },  // Front-left
      { x: -TRUCK_LENGTH / 2 + 20, y: TRUCK_WIDTH / 2 + 3, steer: true, susp: suspFR },   // Front-right
      { x: TRUCK_LENGTH / 2 - 18, y: -TRUCK_WIDTH / 2 - 3, steer: false, susp: suspRL },  // Rear-left
      { x: TRUCK_LENGTH / 2 - 18, y: TRUCK_WIDTH / 2 + 3, steer: false, susp: suspRR },   // Rear-right
    ];
    
    wheelPositions.forEach(wp => {
      ctx.save();
      // Apply suspension compression (wheel moves up relative to body)
      const suspensionOffset = wp.susp * 8;
      ctx.translate(wp.x, wp.y + rollOffset * (wp.y > 0 ? 0.5 : -0.5) - suspensionOffset);
      // Front wheels turn with steering
      if (wp.steer) ctx.rotate(truckData.steerAngle * 0.8);
      
      // Wheel shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(-WHEEL_LENGTH / 2 + 2, -WHEEL_WIDTH / 2 + 2, WHEEL_LENGTH, WHEEL_WIDTH);
      
      // Tire base
      const tireGrad = ctx.createLinearGradient(0, -WHEEL_WIDTH / 2, 0, WHEEL_WIDTH / 2);
      tireGrad.addColorStop(0, '#1a1a1e');
      tireGrad.addColorStop(0.3, '#252528');
      tireGrad.addColorStop(0.5, '#2a2a2e');
      tireGrad.addColorStop(0.7, '#252528');
      tireGrad.addColorStop(1, '#1a1a1e');
      ctx.fillStyle = tireGrad;
      ctx.beginPath();
      ctx.roundRect(-WHEEL_LENGTH / 2, -WHEEL_WIDTH / 2, WHEEL_LENGTH, WHEEL_WIDTH, 2);
      ctx.fill();
      
      // Tire sidewall
      ctx.strokeStyle = '#3a3a3e';
      ctx.lineWidth = 1;
      ctx.strokeRect(-WHEEL_LENGTH / 2 + 1, -WHEEL_WIDTH / 2 + 1, WHEEL_LENGTH - 2, WHEEL_WIDTH - 2);
      
      // Tire tread pattern (more detailed)
      ctx.strokeStyle = 'rgba(60, 60, 65, 0.8)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const tx = -WHEEL_LENGTH / 2 + 1 + i * 2.5;
        ctx.beginPath();
        ctx.moveTo(tx, -WHEEL_WIDTH / 2 + 1);
        ctx.lineTo(tx, WHEEL_WIDTH / 2 - 1);
        ctx.stroke();
      }
      
      // Inner wheel rim (no hubcap, just simple rim)
      ctx.fillStyle = '#3a3a40';
      ctx.beginPath();
      ctx.roundRect(-WHEEL_LENGTH / 2 + 3, -WHEEL_WIDTH / 2 + 2, WHEEL_LENGTH - 6, WHEEL_WIDTH - 4, 1);
      ctx.fill();
      
      ctx.restore();
    });
    
    // === MUDFLAPS (rear wheels) ===
    if (!isAI && (accessories.includes('mudflaps') || accessories.includes('mudflaps_chrome') || accessories.includes('mudflaps_girl'))) {
      const isChrome = accessories.includes('mudflaps_chrome');
      const isGirl = accessories.includes('mudflaps_girl');
      
      // Left mudflap
      ctx.save();
      ctx.translate(TRUCK_LENGTH / 2 - 30, -TRUCK_WIDTH / 2 - 8);
      ctx.fillStyle = isChrome ? '#9ca3af' : '#1f2937';
      ctx.fillRect(0, 0, 8, 12);
      if (isGirl) {
        // Silhouette
        ctx.fillStyle = '#d1d5db';
        ctx.beginPath();
        ctx.arc(4, 5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, 7);
        ctx.lineTo(4, 10);
        ctx.lineTo(6, 7);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      
      // Right mudflap  
      ctx.save();
      ctx.translate(TRUCK_LENGTH / 2 - 30, TRUCK_WIDTH / 2 - 4);
      ctx.fillStyle = isChrome ? '#9ca3af' : '#1f2937';
      ctx.fillRect(0, 0, 8, 12);
      if (isGirl) {
        ctx.fillStyle = '#d1d5db';
        ctx.beginPath();
        ctx.arc(4, 5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, 7);
        ctx.lineTo(4, 10);
        ctx.lineTo(6, 7);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    
    // === CHROME BUMPER ===
    if (!isAI && accessories.includes('bumper_chrome')) {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(-TRUCK_LENGTH / 2 - 2, cabY + 3, 4, cabHeight * rollScale - 6);
      // Chrome shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(-TRUCK_LENGTH / 2 - 1, cabY + 5, 1, cabHeight * rollScale - 10);
    }
    
    // === MESH GRILLE ===
    if (!isAI && accessories.includes('grille_mesh')) {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-TRUCK_LENGTH / 2, cabY + 6, 4, cabHeight * rollScale - 12);
      // Mesh pattern
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 6; i++) {
        const y = cabY + 8 + i * 4;
        ctx.beginPath();
        ctx.moveTo(-TRUCK_LENGTH / 2, y);
        ctx.lineTo(-TRUCK_LENGTH / 2 + 3, y);
        ctx.stroke();
      }
    }
    
    // === SIDE SKIRTS ===
    if (!isAI && accessories.includes('sideskirts')) {
      ctx.fillStyle = '#374151';
      // Bottom of box trailer
      ctx.fillRect(boxStartX, boxY + boxHeight, boxWidth, 3);
      // Aero curve
      ctx.beginPath();
      ctx.moveTo(boxStartX, boxY + boxHeight + 3);
      ctx.quadraticCurveTo(boxStartX + boxWidth / 2, boxY + boxHeight + 6, boxStartX + boxWidth, boxY + boxHeight + 3);
      ctx.lineTo(boxStartX + boxWidth, boxY + boxHeight);
      ctx.lineTo(boxStartX, boxY + boxHeight);
      ctx.closePath();
      ctx.fill();
    }
    
    // === HEADLIGHTS (detailed with housings) ===
    // Headlight housings
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.roundRect(-TRUCK_LENGTH / 2, cabY + 5, 7, 10, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-TRUCK_LENGTH / 2, cabY + cabHeight * rollScale - 15, 7, 10, 2);
    ctx.fill();
    
    // Headlight glow
    ctx.fillStyle = THEME.headlightCore;
    ctx.shadowColor = THEME.headlightGlow;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(-TRUCK_LENGTH / 2 + 3, cabY + 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-TRUCK_LENGTH / 2 + 3, cabY + cabHeight * rollScale - 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Headlight reflection dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(-TRUCK_LENGTH / 2 + 2, cabY + 8, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-TRUCK_LENGTH / 2 + 2, cabY + cabHeight * rollScale - 12, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // === TAIL LIGHTS ===
    const isReversing = truckData.speed < -1;
    const isBraking = truckData.braking;
    
    // Brake light housings
    ctx.fillStyle = '#1f1f22';
    ctx.fillRect(TRUCK_LENGTH / 2 - 5, boxY + 4, 5, 12);
    ctx.fillRect(TRUCK_LENGTH / 2 - 5, boxY + boxHeight - 16, 5, 12);
    
    // Brake lights
    if (isBraking || isReversing) {
      const lightColor = isBraking ? THEME.brakeLightCore : THEME.reverseLightCore;
      const glowColor = isBraking ? THEME.brakeLightGlow : THEME.reverseLightGlow;
      
      // Glow effect
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 20;
      ctx.fillStyle = lightColor;
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#4a1515';
    }
    
    ctx.fillRect(TRUCK_LENGTH / 2 - 4, boxY + 5, 3, 10);
    ctx.fillRect(TRUCK_LENGTH / 2 - 4, boxY + boxHeight - 15, 3, 10);
    ctx.shadowBlur = 0;
    
    // === TURN SIGNALS ===
    turnSignalRef.current = (turnSignalRef.current + 1) % 40;
    const signalOn = turnSignalRef.current < 20;
    
    // Left turn signal (after 180 flip, visually on top)
    if (truckData.steerAngle < -0.1 && signalOn) {
      ctx.fillStyle = THEME.turnSignalAmber;
      ctx.shadowColor = THEME.turnSignalGlow;
      ctx.shadowBlur = 15;
      
      // Front signal
      ctx.beginPath();
      ctx.arc(-TRUCK_LENGTH / 2 + 2, cabY + cabHeight * rollScale - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Rear signal
      ctx.fillRect(TRUCK_LENGTH / 2 - 4, boxY + boxHeight - 4, 3, 3);
      ctx.shadowBlur = 0;
    }
    
    // Right turn signal (after 180 flip, visually on bottom)
    if (truckData.steerAngle > 0.1 && signalOn) {
      ctx.fillStyle = THEME.turnSignalAmber;
      ctx.shadowColor = THEME.turnSignalGlow;
      ctx.shadowBlur = 15;
      
      // Front signal
      ctx.beginPath();
      ctx.arc(-TRUCK_LENGTH / 2 + 2, cabY + 2, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Rear signal
      ctx.fillRect(TRUCK_LENGTH / 2 - 4, boxY + 1, 3, 3);
      ctx.shadowBlur = 0;
    }
    
    ctx.restore();
  };

  const drawObstacles = (ctx) => {
    const allObstacles = [...(levelConfig.obstacles || []), ...movingObstaclesRef.current];
    const currentTruck = truckRef.current;
    
    allObstacles.forEach(obs => {
      ctx.save();
      ctx.translate(obs.x, obs.y);
      ctx.rotate(obs.angle || 0);
      
      // Calculate proximity to truck for danger highlighting
      let dangerLevel = 0;
      if (currentTruck) {
        const dx = currentTruck.x - obs.x;
        const dy = currentTruck.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dangerThreshold = 80;
        if (dist < dangerThreshold) {
          dangerLevel = 1 - (dist / dangerThreshold);
        }
      }
      
      // Draw danger glow for close obstacles
      if (dangerLevel > 0.2 && !accessibility.reducedMotion) {
        const glowIntensity = dangerLevel * 0.6;
        ctx.shadowColor = `rgba(239, 68, 68, ${glowIntensity})`;
        ctx.shadowBlur = 15 + dangerLevel * 10;
      }
      
      switch (obs.type) {
        case 'cone':
          // Cone shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.beginPath();
          ctx.ellipse(3, 5, 12, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Cone base
          ctx.fillStyle = '#374151';
          ctx.beginPath();
          ctx.ellipse(0, 8, 10, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Cone body gradient
          const coneGrad = ctx.createLinearGradient(-8, 0, 8, 0);
          coneGrad.addColorStop(0, '#ea580c');
          coneGrad.addColorStop(0.3, '#f97316');
          coneGrad.addColorStop(0.7, '#fb923c');
          coneGrad.addColorStop(1, '#f97316');
          ctx.fillStyle = coneGrad;
          ctx.beginPath();
          ctx.moveTo(0, -14);
          ctx.lineTo(10, 8);
          ctx.lineTo(-10, 8);
          ctx.closePath();
          ctx.fill();
          
          // White reflective stripes
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(-6, 0);
          ctx.lineTo(6, 0);
          ctx.lineTo(5, 3);
          ctx.lineTo(-5, 3);
          ctx.closePath();
          ctx.fill();
          
          ctx.beginPath();
          ctx.moveTo(-4, -5);
          ctx.lineTo(4, -5);
          ctx.lineTo(3, -3);
          ctx.lineTo(-3, -3);
          ctx.closePath();
          ctx.fill();
          
          // Highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.moveTo(-2, -12);
          ctx.lineTo(0, -14);
          ctx.lineTo(3, 6);
          ctx.lineTo(-2, 6);
          ctx.closePath();
          ctx.fill();
          break;
          
        case 'car':
          const carW = obs.width || 48;
          const carH = obs.height || 26;
          
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.filter = 'blur(3px)';
          ctx.beginPath();
          ctx.roundRect(-carW / 2 + 4, -carH / 2 + 4, carW, carH, 5);
          ctx.fill();
          ctx.filter = 'none';
          
          // Body gradient
          const carGrad = ctx.createLinearGradient(0, -carH / 2, 0, carH / 2);
          carGrad.addColorStop(0, '#94a3b8');
          carGrad.addColorStop(0.3, '#64748b');
          carGrad.addColorStop(0.7, '#475569');
          carGrad.addColorStop(1, '#64748b');
          ctx.fillStyle = carGrad;
          ctx.beginPath();
          ctx.roundRect(-carW / 2, -carH / 2, carW, carH, 5);
          ctx.fill();
          
          // Roof
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.roundRect(-carW / 2 + 10, -carH / 2 + 3, carW - 20, carH - 6, 3);
          ctx.fill();
          
          // Windows
          const winGrad = ctx.createLinearGradient(0, -carH / 2, 0, carH / 2);
          winGrad.addColorStop(0, '#1e293b');
          winGrad.addColorStop(0.5, '#0f172a');
          winGrad.addColorStop(1, '#1e293b');
          ctx.fillStyle = winGrad;
          ctx.beginPath();
          ctx.roundRect(-carW / 2 + 12, -carH / 2 + 5, carW - 24, carH - 10, 2);
          ctx.fill();
          
          // Window reflection
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.moveTo(-carW / 2 + 14, -carH / 2 + 6);
          ctx.lineTo(-carW / 2 + 18, -carH / 2 + 6);
          ctx.lineTo(-carW / 2 + 14, carH / 2 - 6);
          ctx.closePath();
          ctx.fill();
          
          // Headlights
          ctx.fillStyle = '#fef3c7';
          ctx.shadowColor = 'rgba(254, 243, 199, 0.5)';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(-carW / 2 + 4, -carH / 2 + 5, 3, 0, Math.PI * 2);
          ctx.arc(-carW / 2 + 4, carH / 2 - 5, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // Taillights
          ctx.fillStyle = '#7f1d1d';
          ctx.beginPath();
          ctx.roundRect(carW / 2 - 5, -carH / 2 + 4, 3, 6, 1);
          ctx.roundRect(carW / 2 - 5, carH / 2 - 10, 3, 6, 1);
          ctx.fill();
          break;
          
        case 'dumpster':
          const dumpW = obs.width || 65;
          const dumpH = obs.height || 45;
          
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(-dumpW / 2 + 5, -dumpH / 2 + 5, dumpW, dumpH);
          
          // Body gradient
          const dumpGrad = ctx.createLinearGradient(0, -dumpH / 2, 0, dumpH / 2);
          dumpGrad.addColorStop(0, '#166534');
          dumpGrad.addColorStop(0.5, '#14532d');
          dumpGrad.addColorStop(1, '#166534');
          ctx.fillStyle = dumpGrad;
          ctx.fillRect(-dumpW / 2, -dumpH / 2, dumpW, dumpH);
          
          // Lid
          ctx.fillStyle = '#15803d';
          ctx.fillRect(-dumpW / 2, -dumpH / 2, dumpW, 12);
          
          // Lid line
          ctx.strokeStyle = '#0f4c28';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-dumpW / 2, -dumpH / 2 + 12);
          ctx.lineTo(dumpW / 2, -dumpH / 2 + 12);
          ctx.stroke();
          
          // Side ridges
          ctx.strokeStyle = '#0a3015';
          ctx.lineWidth = 1;
          for (let i = 1; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(-dumpW / 2, -dumpH / 2 + 12 + i * 8);
            ctx.lineTo(dumpW / 2, -dumpH / 2 + 12 + i * 8);
            ctx.stroke();
          }
          
          // Handles
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(-dumpW / 2 - 3, -dumpH / 2 + 15, 6, 15);
          ctx.fillRect(dumpW / 2 - 3, -dumpH / 2 + 15, 6, 15);
          break;
          
        case 'trailer':
          const trailerW = obs.width || 130;
          const trailerH = obs.height || 48;
          
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(-trailerW / 2 + 6, -trailerH / 2 + 6, trailerW, trailerH);
          
          // Body gradient
          const trailerGrad = ctx.createLinearGradient(0, -trailerH / 2, 0, trailerH / 2);
          trailerGrad.addColorStop(0, '#9ca3af');
          trailerGrad.addColorStop(0.3, '#6b7280');
          trailerGrad.addColorStop(0.7, '#4b5563');
          trailerGrad.addColorStop(1, '#6b7280');
          ctx.fillStyle = trailerGrad;
          ctx.fillRect(-trailerW / 2, -trailerH / 2, trailerW, trailerH);
          
          // Panel lines
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.lineWidth = 1;
          for (let i = 1; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(-trailerW / 2 + i * (trailerW / 6), -trailerH / 2);
            ctx.lineTo(-trailerW / 2 + i * (trailerW / 6), trailerH / 2);
            ctx.stroke();
          }
          
          // Top highlight
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-trailerW / 2, -trailerH / 2 + 1);
          ctx.lineTo(trailerW / 2, -trailerH / 2 + 1);
          ctx.stroke();
          
          // Rear door
          ctx.fillStyle = '#4b5563';
          ctx.fillRect(trailerW / 2 - 6, -trailerH / 2 + 4, 4, trailerH - 8);
          
          // Wheels
          ctx.fillStyle = '#1a1a1e';
          ctx.fillRect(trailerW / 2 - 25, -trailerH / 2 - 4, 10, 6);
          ctx.fillRect(trailerW / 2 - 25, trailerH / 2 - 2, 10, 6);
          ctx.fillRect(trailerW / 2 - 40, -trailerH / 2 - 4, 10, 6);
          ctx.fillRect(trailerW / 2 - 40, trailerH / 2 - 2, 10, 6);
          break;
          
        case 'wall':
          const wallW = obs.width || 20;
          const wallH = obs.height || 280;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(-wallW / 2 + 4, -wallH / 2 + 4, wallW, wallH);
          
          const wallGrad = ctx.createLinearGradient(-wallW / 2, 0, wallW / 2, 0);
          wallGrad.addColorStop(0, '#4b5563');
          wallGrad.addColorStop(0.5, '#6b7280');
          wallGrad.addColorStop(1, '#4b5563');
          ctx.fillStyle = wallGrad;
          ctx.fillRect(-wallW / 2, -wallH / 2, wallW, wallH);
          
          // Warning stripes
          ctx.fillStyle = THEME.lineYellow;
          for (let y = -wallH / 2; y < wallH / 2; y += 30) {
            ctx.fillRect(-wallW / 2, y, wallW, 8);
          }
          break;
          
        case 'cart':
          const cartW = obs.width || 22;
          const cartH = obs.height || 16;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(-cartW / 2 + 2, -cartH / 2 + 2, cartW, cartH);
          
          const cartGrad = ctx.createLinearGradient(0, -cartH / 2, 0, cartH / 2);
          cartGrad.addColorStop(0, '#d1d5db');
          cartGrad.addColorStop(0.5, '#9ca3af');
          cartGrad.addColorStop(1, '#d1d5db');
          ctx.fillStyle = cartGrad;
          ctx.fillRect(-cartW / 2, -cartH / 2, cartW, cartH);
          
          // Mesh pattern
          ctx.strokeStyle = '#6b7280';
          ctx.lineWidth = 1;
          for (let x = -cartW / 2 + 4; x < cartW / 2; x += 4) {
            ctx.beginPath();
            ctx.moveTo(x, -cartH / 2);
            ctx.lineTo(x, cartH / 2);
            ctx.stroke();
          }
          
          // Handle
          ctx.fillStyle = '#4b5563';
          ctx.fillRect(cartW / 2, -cartH / 2 + 2, 10, 3);
          ctx.fillRect(cartW / 2 + 8, -cartH / 2, 3, cartH);
          
          // Wheels
          ctx.fillStyle = '#1a1a1e';
          ctx.beginPath();
          ctx.arc(-cartW / 2, cartH / 2, 3, 0, Math.PI * 2);
          ctx.arc(cartW / 2, cartH / 2, 3, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'pedestrian':
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.beginPath();
          ctx.ellipse(2, 3, 10, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Body
          ctx.fillStyle = '#374151';
          ctx.beginPath();
          ctx.ellipse(0, 3, 6, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Safety vest
          const vestGrad = ctx.createLinearGradient(-5, 0, 5, 0);
          vestGrad.addColorStop(0, '#f59e0b');
          vestGrad.addColorStop(0.5, '#fbbf24');
          vestGrad.addColorStop(1, '#f59e0b');
          ctx.fillStyle = vestGrad;
          ctx.beginPath();
          ctx.ellipse(0, 2, 5, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Reflective stripe
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(-5, 0, 10, 2);
          
          // Hard hat
          const hatGrad = ctx.createRadialGradient(0, -6, 0, 0, -6, 8);
          hatGrad.addColorStop(0, '#fbbf24');
          hatGrad.addColorStop(1, '#d97706');
          ctx.fillStyle = hatGrad;
          ctx.beginPath();
          ctx.arc(0, -6, 7, Math.PI, 0);
          ctx.fill();
          
          // Hat brim
          ctx.fillStyle = '#b45309';
          ctx.fillRect(-8, -6, 16, 2);
          break;
          
        case 'bollard':
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.beginPath();
          ctx.ellipse(3, 3, 12, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Base plate
          ctx.fillStyle = '#374151';
          ctx.beginPath();
          ctx.ellipse(0, 8, 14, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Post body
          const bollardGrad = ctx.createLinearGradient(-8, 0, 8, 0);
          bollardGrad.addColorStop(0, '#f59e0b');
          bollardGrad.addColorStop(0.3, '#fbbf24');
          bollardGrad.addColorStop(0.7, '#fbbf24');
          bollardGrad.addColorStop(1, '#d97706');
          ctx.fillStyle = bollardGrad;
          ctx.fillRect(-8, -18, 16, 26);
          
          // Reflective bands
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(-9, -12, 18, 4);
          ctx.fillRect(-9, -2, 18, 4);
          
          // Top cap
          ctx.fillStyle = '#374151';
          ctx.beginPath();
          ctx.ellipse(0, -18, 8, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(-6, -16, 3, 20);
          break;
          
        case 'pallet':
          const palletW = obs.width || 40;
          const palletH = obs.height || 48;
          
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(-palletW / 2 + 3, -palletH / 2 + 3, palletW, palletH);
          
          // Pallet base (wooden color)
          ctx.fillStyle = '#92400e';
          ctx.fillRect(-palletW / 2, -palletH / 2, palletW, palletH);
          
          // Wood grain pattern
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 1;
          // Horizontal slats
          for (let i = 0; i < 4; i++) {
            const y = -palletH / 2 + 4 + i * (palletH - 8) / 3;
            ctx.beginPath();
            ctx.moveTo(-palletW / 2, y);
            ctx.lineTo(palletW / 2, y);
            ctx.stroke();
          }
          // Vertical supports
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-palletW / 2 + 3, -palletH / 2, 4, palletH);
          ctx.fillRect(palletW / 2 - 7, -palletH / 2, 4, palletH);
          ctx.fillRect(-2, -palletH / 2, 4, palletH);
          
          // Boxes on pallet (if tall)
          if (palletH > 40) {
            // Cardboard boxes
            ctx.fillStyle = '#a16207';
            ctx.fillRect(-palletW / 2 + 4, -palletH / 2 + 6, palletW - 8, palletH - 16);
            
            // Box tape
            ctx.fillStyle = '#ca8a04';
            ctx.fillRect(-2, -palletH / 2 + 6, 4, palletH - 16);
            
            // Box highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(-palletW / 2 + 4, -palletH / 2 + 6, palletW - 8, 4);
          }
          break;
          
        case 'forklift':
          // Forklift dimensions
          const forkW = obs.width || 35;
          const forkH = obs.height || 55;
          
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.beginPath();
          ctx.roundRect(-forkW / 2 + 4, -forkH / 2 + 4, forkW, forkH, 3);
          ctx.fill();
          
          // Main body
          const forkBodyGrad = ctx.createLinearGradient(-forkW / 2, 0, forkW / 2, 0);
          forkBodyGrad.addColorStop(0, '#ca8a04');
          forkBodyGrad.addColorStop(0.3, '#eab308');
          forkBodyGrad.addColorStop(0.7, '#facc15');
          forkBodyGrad.addColorStop(1, '#eab308');
          ctx.fillStyle = forkBodyGrad;
          ctx.beginPath();
          ctx.roundRect(-forkW / 2, -forkH / 2 + 15, forkW, forkH - 20, 3);
          ctx.fill();
          
          // Mast (lifting tower)
          ctx.fillStyle = '#374151';
          ctx.fillRect(-3, -forkH / 2, 6, 20);
          ctx.fillRect(-8, -forkH / 2 - 5, 16, 8);
          
          // Forks
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(-12, -forkH / 2 - 3, 4, 15);
          ctx.fillRect(8, -forkH / 2 - 3, 4, 15);
          
          // Cage/overhead guard
          ctx.strokeStyle = '#4b5563';
          ctx.lineWidth = 2;
          ctx.strokeRect(-forkW / 2 + 3, -forkH / 2 + 12, forkW - 6, 18);
          
          // Wheels
          ctx.fillStyle = '#1a1a1e';
          ctx.beginPath();
          ctx.arc(-forkW / 2 + 6, forkH / 2 - 6, 6, 0, Math.PI * 2);
          ctx.arc(forkW / 2 - 6, forkH / 2 - 6, 6, 0, Math.PI * 2);
          ctx.fill();
          
          // Rear wheel (smaller)
          ctx.beginPath();
          ctx.arc(0, forkH / 2 - 4, 4, 0, Math.PI * 2);
          ctx.fill();
          
          // Warning stripes
          ctx.fillStyle = '#1a1a1e';
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(-forkW / 2 + 5 + i * 10, -forkH / 2 + 32, 5, 3);
          }
          
          // Light (flashing if moving)
          const isMoving = obs.speed && Math.abs(obs.speed) > 0;
          const flashOn = isMoving && Math.sin(Date.now() / 200) > 0;
          ctx.fillStyle = flashOn ? '#f97316' : '#9a3412';
          ctx.shadowColor = flashOn ? 'rgba(249, 115, 22, 0.6)' : 'transparent';
          ctx.shadowBlur = flashOn ? 8 : 0;
          ctx.beginPath();
          ctx.arc(0, -forkH / 2 + 8, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          break;
          
        case 'oilslick':
          // Oil spill - affects handling when driven over
          const oilW = obs.width || 60;
          const oilH = obs.height || 40;
          
          // Dark oil puddle with rainbow sheen
          const oilGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, oilW / 2);
          oilGrad.addColorStop(0, 'rgba(15, 15, 20, 0.8)');
          oilGrad.addColorStop(0.5, 'rgba(20, 20, 25, 0.7)');
          oilGrad.addColorStop(1, 'rgba(10, 10, 15, 0.4)');
          ctx.fillStyle = oilGrad;
          ctx.beginPath();
          ctx.ellipse(0, 0, oilW / 2, oilH / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Rainbow sheen effect
          const sheenGrad = ctx.createLinearGradient(-oilW / 3, -oilH / 3, oilW / 3, oilH / 3);
          sheenGrad.addColorStop(0, 'rgba(147, 51, 234, 0.15)');
          sheenGrad.addColorStop(0.25, 'rgba(59, 130, 246, 0.15)');
          sheenGrad.addColorStop(0.5, 'rgba(34, 197, 94, 0.12)');
          sheenGrad.addColorStop(0.75, 'rgba(234, 179, 8, 0.1)');
          sheenGrad.addColorStop(1, 'rgba(239, 68, 68, 0.08)');
          ctx.fillStyle = sheenGrad;
          ctx.beginPath();
          ctx.ellipse(5, -3, oilW / 2.5, oilH / 2.5, 0.2, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'puddle':
          // Water puddle - slippery surface
          const pudW = obs.width || 50;
          const pudH = obs.height || 35;
          
          // Water reflection
          const pudGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, pudW / 2);
          pudGrad.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
          pudGrad.addColorStop(0.6, 'rgba(37, 99, 235, 0.3)');
          pudGrad.addColorStop(1, 'rgba(30, 64, 175, 0.2)');
          ctx.fillStyle = pudGrad;
          ctx.beginPath();
          ctx.ellipse(0, 0, pudW / 2, pudH / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Ripple effect
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
          for (let i = 1; i <= 2; i++) {
            ctx.beginPath();
            ctx.ellipse(0, 0, pudW / 2 - i * 8, pudH / 2 - i * 5, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          // Highlight reflection
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.ellipse(-pudW / 4, -pudH / 4, 8, 4, -0.5, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'barrel':
          // Industrial barrel
          const barrelR = (obs.width || 24) / 2;
          
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.beginPath();
          ctx.ellipse(3, 3, barrelR, barrelR * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Barrel body
          const barrelGrad = ctx.createRadialGradient(-barrelR / 3, -barrelR / 3, 0, 0, 0, barrelR);
          barrelGrad.addColorStop(0, '#3b82f6');
          barrelGrad.addColorStop(0.5, '#2563eb');
          barrelGrad.addColorStop(1, '#1d4ed8');
          ctx.fillStyle = barrelGrad;
          ctx.beginPath();
          ctx.arc(0, 0, barrelR, 0, Math.PI * 2);
          ctx.fill();
          
          // Top rim
          ctx.strokeStyle = '#1e40af';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, barrelR - 2, 0, Math.PI * 2);
          ctx.stroke();
          
          // Bands
          ctx.strokeStyle = '#1e3a8a';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, barrelR - 5, 0, Math.PI * 2);
          ctx.stroke();
          
          // Cap
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(0, -4, 4, 0, Math.PI * 2);
          ctx.fill();
          
          // Highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.ellipse(-barrelR / 2, -barrelR / 2, 4, 6, -0.5, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'spilledcargo':
          // Spilled boxes and debris
          const spillW = obs.width || 70;
          const spillH = obs.height || 50;
          
          // Scattered boxes
          ctx.fillStyle = '#92400e';
          ctx.save();
          ctx.rotate(-0.2);
          ctx.fillRect(-spillW / 2, -spillH / 2 + 5, 20, 15);
          ctx.restore();
          
          ctx.save();
          ctx.rotate(0.15);
          ctx.fillRect(-5, -10, 18, 14);
          ctx.restore();
          
          ctx.save();
          ctx.rotate(-0.1);
          ctx.fillRect(spillW / 2 - 22, -spillH / 2 + 8, 16, 12);
          ctx.restore();
          
          // Tape on boxes
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(-spillW / 2 + 8, -spillH / 2 + 10, 4, 8);
          ctx.fillRect(3, -5, 4, 8);
          
          // Loose items
          ctx.fillStyle = '#d1d5db';
          ctx.beginPath();
          ctx.arc(-10, spillH / 2 - 10, 5, 0, Math.PI * 2);
          ctx.arc(15, spillH / 2 - 8, 4, 0, Math.PI * 2);
          ctx.arc(spillW / 2 - 10, 0, 3, 0, Math.PI * 2);
          ctx.fill();
          
          // Packing peanuts scatter
          ctx.fillStyle = '#fef3c7';
          for (let i = 0; i < 8; i++) {
            const px = (Math.sin(i * 1.3) * spillW / 2.5);
            const py = (Math.cos(i * 1.7) * spillH / 2.5);
            ctx.beginPath();
            ctx.ellipse(px, py, 3, 2, i * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
          
        case 'pedestrian_zone':
          // Pedestrian crossing / safety zone - instant fail if entered
          const pzW = obs.width || 80;
          const pzH = obs.height || 60;
          
          // Warning zone background
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.fillRect(-pzW / 2, -pzH / 2, pzW, pzH);
          
          // Red border
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 4]);
          ctx.strokeRect(-pzW / 2, -pzH / 2, pzW, pzH);
          ctx.setLineDash([]);
          
          // Diagonal warning stripes
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.lineWidth = 4;
          for (let i = -pzW; i < pzW + pzH; i += 15) {
            ctx.beginPath();
            ctx.moveTo(-pzW / 2 + i, -pzH / 2);
            ctx.lineTo(-pzW / 2 + i - pzH, pzH / 2);
            ctx.stroke();
          }
          
          // Pedestrian icon in center
          ctx.fillStyle = '#dc2626';
          // Head
          ctx.beginPath();
          ctx.arc(0, -10, 6, 0, Math.PI * 2);
          ctx.fill();
          // Body
          ctx.fillRect(-3, -4, 6, 14);
          // Arms
          ctx.fillRect(-10, -2, 20, 4);
          // Legs
          ctx.beginPath();
          ctx.moveTo(-2, 10);
          ctx.lineTo(-6, 20);
          ctx.lineTo(-3, 20);
          ctx.lineTo(0, 12);
          ctx.lineTo(3, 20);
          ctx.lineTo(6, 20);
          ctx.lineTo(2, 10);
          ctx.closePath();
          ctx.fill();
          
          // Warning text
          ctx.font = 'bold 8px "JetBrains Mono", monospace';
          ctx.fillStyle = '#dc2626';
          ctx.textAlign = 'center';
          ctx.fillText('⚠ NO ENTRY', 0, pzH / 2 - 5);
          break;
          
        case 'moving_truck':
          // Another truck - moving obstacle
          const mtW = obs.width || 130;
          const mtH = obs.height || 48;
          
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.beginPath();
          ctx.roundRect(-mtW / 2 + 4, -mtH / 2 + 4, mtW, mtH, 4);
          ctx.fill();
          
          // Truck cab (front)
          const cabLen = 25;
          const truckColor = obs.color || '#6b7280';
          ctx.fillStyle = truckColor;
          ctx.beginPath();
          ctx.roundRect(-mtW / 2, -mtH / 2, cabLen, mtH, [4, 0, 0, 4]);
          ctx.fill();
          
          // Cab window
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect(-mtW / 2 + 3, -mtH / 2 + 5, cabLen - 8, mtH - 10, 2);
          ctx.fill();
          
          // Box trailer
          const boxGrad = ctx.createLinearGradient(0, -mtH / 2, 0, mtH / 2);
          boxGrad.addColorStop(0, '#e5e7eb');
          boxGrad.addColorStop(0.5, '#d1d5db');
          boxGrad.addColorStop(1, '#9ca3af');
          ctx.fillStyle = boxGrad;
          ctx.fillRect(-mtW / 2 + cabLen, -mtH / 2 + 2, mtW - cabLen - 2, mtH - 4);
          
          // Box ridges
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.lineWidth = 1;
          for (let i = 1; i < 5; i++) {
            const xPos = -mtW / 2 + cabLen + i * ((mtW - cabLen) / 5);
            ctx.beginPath();
            ctx.moveTo(xPos, -mtH / 2 + 2);
            ctx.lineTo(xPos, mtH / 2 - 2);
            ctx.stroke();
          }
          
          // Wheels
          ctx.fillStyle = '#1a1a1e';
          // Front wheels
          ctx.beginPath();
          ctx.ellipse(-mtW / 2 + 8, -mtH / 2 - 2, 6, 4, 0, 0, Math.PI * 2);
          ctx.ellipse(-mtW / 2 + 8, mtH / 2 + 2, 6, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          // Rear wheels (dual)
          ctx.beginPath();
          ctx.ellipse(mtW / 2 - 15, -mtH / 2 - 2, 6, 4, 0, 0, Math.PI * 2);
          ctx.ellipse(mtW / 2 - 15, mtH / 2 + 2, 6, 4, 0, 0, Math.PI * 2);
          ctx.ellipse(mtW / 2 - 25, -mtH / 2 - 2, 6, 4, 0, 0, Math.PI * 2);
          ctx.ellipse(mtW / 2 - 25, mtH / 2 + 2, 6, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Headlights / taillights based on direction
          const isMovingForward = obs.speed && obs.speed > 0;
          if (isMovingForward) {
            // Headlights on front
            ctx.fillStyle = '#fef3c7';
            ctx.shadowColor = 'rgba(254, 243, 199, 0.5)';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(-mtW / 2 + 2, -mtH / 2 + 8, 3, 0, Math.PI * 2);
            ctx.arc(-mtW / 2 + 2, mtH / 2 - 8, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          } else {
            // Taillights on rear
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(mtW / 2 - 2, -mtH / 2 + 6, 3, 0, Math.PI * 2);
            ctx.arc(mtW / 2 - 2, mtH / 2 - 6, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          break;
      }
      
      ctx.restore();
    });
  };

  const drawGuidelines = (ctx) => {
    const guideTruck = truckRef.current;
    if (!guideTruck) return;
    const dock = levelConfig.dock;
    
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    
    ctx.beginPath();
    ctx.moveTo(guideTruck.x, guideTruck.y);
    ctx.lineTo(dock.x, dock.y);
    ctx.stroke();
    
    ctx.setLineDash([]);
  };

  const drawNightOverlay = (ctx) => {
    // Dark overlay with vignette
    const vignetteGrad = ctx.createRadialGradient(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.8
    );
    vignetteGrad.addColorStop(0, 'rgba(8, 15, 25, 0.75)');
    vignetteGrad.addColorStop(0.6, 'rgba(8, 15, 25, 0.85)');
    vignetteGrad.addColorStop(1, 'rgba(5, 10, 18, 0.95)');
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Headlight beams with realistic cone effect
    const nightTruck = truckRef.current;
    if (nightTruck) {
      ctx.save();
      ctx.translate(nightTruck.x, nightTruck.y);
      ctx.rotate(nightTruck.angle);
      ctx.rotate(Math.PI); // Match truck visual orientation
      
      // Left headlight beam (from cab)
      const leftBeam = ctx.createRadialGradient(-TRUCK_LENGTH / 2, -TRUCK_WIDTH / 2 + 8, 0, -TRUCK_LENGTH / 2 - 180, -60, 200);
      leftBeam.addColorStop(0, 'rgba(255, 254, 240, 0.5)');
      leftBeam.addColorStop(0.3, 'rgba(255, 254, 240, 0.2)');
      leftBeam.addColorStop(0.7, 'rgba(255, 254, 240, 0.05)');
      leftBeam.addColorStop(1, 'transparent');
      
      ctx.fillStyle = leftBeam;
      ctx.beginPath();
      ctx.moveTo(-TRUCK_LENGTH / 2, -TRUCK_WIDTH / 2 + 8);
      ctx.lineTo(-TRUCK_LENGTH / 2 - 350, -180);
      ctx.lineTo(-TRUCK_LENGTH / 2 - 350, 60);
      ctx.closePath();
      ctx.fill();
      
      // Right headlight beam
      const rightBeam = ctx.createRadialGradient(-TRUCK_LENGTH / 2, TRUCK_WIDTH / 2 - 8, 0, -TRUCK_LENGTH / 2 - 180, 60, 200);
      rightBeam.addColorStop(0, 'rgba(255, 254, 240, 0.5)');
      rightBeam.addColorStop(0.3, 'rgba(255, 254, 240, 0.2)');
      rightBeam.addColorStop(0.7, 'rgba(255, 254, 240, 0.05)');
      rightBeam.addColorStop(1, 'transparent');
      
      ctx.fillStyle = rightBeam;
      ctx.beginPath();
      ctx.moveTo(-TRUCK_LENGTH / 2, TRUCK_WIDTH / 2 - 8);
      ctx.lineTo(-TRUCK_LENGTH / 2 - 350, -60);
      ctx.lineTo(-TRUCK_LENGTH / 2 - 350, 180);
      ctx.closePath();
      ctx.fill();
      
      // Central beam overlap (brighter center)
      const centerBeam = ctx.createRadialGradient(-TRUCK_LENGTH / 2, 0, 0, -TRUCK_LENGTH / 2 - 200, 0, 250);
      centerBeam.addColorStop(0, 'rgba(255, 254, 240, 0.3)');
      centerBeam.addColorStop(0.5, 'rgba(255, 254, 240, 0.1)');
      centerBeam.addColorStop(1, 'transparent');
      
      ctx.fillStyle = centerBeam;
      ctx.beginPath();
      ctx.moveTo(-TRUCK_LENGTH / 2, -10);
      ctx.lineTo(-TRUCK_LENGTH / 2 - 300, -80);
      ctx.lineTo(-TRUCK_LENGTH / 2 - 300, 80);
      ctx.lineTo(-TRUCK_LENGTH / 2, 10);
      ctx.closePath();
      ctx.fill();
      
      // Headlight flare - enhanced with lens flare elements
      // Main glow
      ctx.fillStyle = 'rgba(255, 254, 240, 0.2)';
      ctx.beginPath();
      ctx.arc(-TRUCK_LENGTH / 2, -TRUCK_WIDTH / 2 + 8, 30, 0, Math.PI * 2);
      ctx.arc(-TRUCK_LENGTH / 2, TRUCK_WIDTH / 2 - 8, 30, 0, Math.PI * 2);
      ctx.fill();
      
      // Lens flare streaks
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      
      // Horizontal streak
      const streakGrad = ctx.createLinearGradient(-TRUCK_LENGTH / 2 - 50, 0, -TRUCK_LENGTH / 2 + 30, 0);
      streakGrad.addColorStop(0, 'transparent');
      streakGrad.addColorStop(0.3, 'rgba(255, 254, 240, 0.1)');
      streakGrad.addColorStop(0.5, 'rgba(255, 254, 240, 0.2)');
      streakGrad.addColorStop(0.7, 'rgba(255, 254, 240, 0.1)');
      streakGrad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = streakGrad;
      ctx.fillRect(-TRUCK_LENGTH / 2 - 50, -TRUCK_WIDTH / 2 + 4, 80, 8);
      ctx.fillRect(-TRUCK_LENGTH / 2 - 50, TRUCK_WIDTH / 2 - 12, 80, 8);
      
      // Lens flare circles (along axis from headlight)
      const flarePositions = [
        { dist: 40, size: 8, opacity: 0.1 },
        { dist: 70, size: 12, opacity: 0.08 },
        { dist: 100, size: 6, opacity: 0.12 },
        { dist: 140, size: 15, opacity: 0.05 },
      ];
      
      flarePositions.forEach(flare => {
        ctx.fillStyle = `rgba(255, 200, 150, ${flare.opacity})`;
        ctx.beginPath();
        ctx.arc(-TRUCK_LENGTH / 2 - flare.dist, 0, flare.size, 0, Math.PI * 2);
        ctx.fill();
      });
      
      ctx.restore();
      
      ctx.restore();
    }
    
    // Ambient dock lights visibility
    const dock = levelConfig.dock;
    const dockGlow = ctx.createRadialGradient(dock.x, dock.y, 0, dock.x, dock.y, 100);
    dockGlow.addColorStop(0, 'rgba(239, 68, 68, 0.2)');
    dockGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = dockGlow;
    ctx.beginPath();
    ctx.arc(dock.x, dock.y, 100, 0, Math.PI * 2);
    ctx.fill();
  };

  // Fog overlay for fog mode
  const drawFogOverlay = (ctx) => {
    const fogTruck = truckRef.current;
    if (!fogTruck) return;
    
    const visRadius = levelConfig.visibilityRadius || 100;
    
    // Create fog effect - visibility only around truck
    ctx.save();
    
    // Draw dense fog everywhere except around truck
    ctx.fillStyle = 'rgba(180, 185, 195, 0.95)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Cut out visibility circle around truck
    ctx.globalCompositeOperation = 'destination-out';
    
    // Main visibility circle with soft edge
    const visGrad = ctx.createRadialGradient(
      fogTruck.x, fogTruck.y, visRadius * 0.6,
      fogTruck.x, fogTruck.y, visRadius * 1.2
    );
    visGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    visGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.8)');
    visGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = visGrad;
    ctx.beginPath();
    ctx.arc(fogTruck.x, fogTruck.y, visRadius * 1.2, 0, Math.PI * 2);
    ctx.fill();
    
    // Also add visibility around dock
    const dock = levelConfig.dock;
    const dockVisGrad = ctx.createRadialGradient(
      dock.x, dock.y, 30,
      dock.x, dock.y, 80
    );
    dockVisGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    dockVisGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = dockVisGrad;
    ctx.beginPath();
    ctx.arc(dock.x, dock.y, 80, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Add some swirling fog particles for atmosphere
    ctx.fillStyle = 'rgba(200, 205, 215, 0.3)';
    const time = Date.now() * 0.0005;
    for (let i = 0; i < 15; i++) {
      const angle = time + i * 0.5;
      const radius = 100 + Math.sin(angle * 2) * 50;
      const fx = fogTruck.x + Math.cos(angle) * radius;
      const fy = fogTruck.y + Math.sin(angle) * radius;
      
      // Only show fog particles outside visibility radius
      const distFromTruck = Math.sqrt(Math.pow(fx - fogTruck.x, 2) + Math.pow(fy - fogTruck.y, 2));
      if (distFromTruck > visRadius * 0.8) {
        ctx.globalAlpha = 0.2 + Math.sin(time + i) * 0.1;
        ctx.beginPath();
        ctx.arc(fx, fy, 15 + Math.sin(i) * 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  // Draw weather effects (snow)
  const drawWeatherEffects = (ctx) => {
    if (currentWeather !== 'snow') return;
    
    const time = Date.now() * 0.001;
    
    // Falling snowflakes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 100; i++) {
      const x = (i * 53 + time * 20) % CANVAS_WIDTH;
      const y = (i * 37 + time * 40) % CANVAS_HEIGHT;
      const size = 2 + (i % 3);
      ctx.globalAlpha = 0.4 + Math.sin(i + time) * 0.2;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Snow accumulation on ground edges
    snowAccumulationRef.current = Math.min(1, snowAccumulationRef.current + 0.001);
    const snowHeight = snowAccumulationRef.current * 15;
    ctx.fillStyle = 'rgba(240, 245, 255, 0.3)';
    ctx.fillRect(0, CANVAS_HEIGHT - snowHeight, CANVAS_WIDTH, snowHeight);
  };
  
  // Draw time of day lighting
  const drawTimeOfDayLighting = (ctx) => {
    const tod = TIME_OF_DAY[timeOfDay];
    if (!tod) return;
    
    // Apply tint
    if (tod.tint) {
      ctx.fillStyle = tod.tint;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    
    // Dawn/dusk sun glow
    if (timeOfDay === 'dawn' || timeOfDay === 'dusk') {
      const sunX = timeOfDay === 'dawn' ? CANVAS_WIDTH * 0.2 : CANVAS_WIDTH * 0.8;
      const sunY = 50;
      
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 200);
      sunGlow.addColorStop(0, timeOfDay === 'dawn' ? 'rgba(255, 200, 120, 0.3)' : 'rgba(255, 140, 80, 0.3)');
      sunGlow.addColorStop(0.5, timeOfDay === 'dawn' ? 'rgba(255, 180, 100, 0.1)' : 'rgba(255, 100, 60, 0.1)');
      sunGlow.addColorStop(1, 'transparent');
      
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    
    // Night darkness (if not already handled by night mode)
    if (timeOfDay === 'night' && !levelConfig.nightMode) {
      ctx.fillStyle = 'rgba(10, 15, 25, 0.6)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  };
  
  // Draw environment-specific decorations
  const drawEnvironmentDecorations = (ctx) => {
    const env = ENVIRONMENTS[currentEnvironment];
    if (!env) return;
    
    // Port environment - shipping containers in background
    if (currentEnvironment === 'port') {
      const containers = [
        { x: 50, y: 40, color: '#dc2626' },
        { x: 150, y: 35, color: '#2563eb' },
        { x: 650, y: 38, color: '#16a34a' },
        { x: 720, y: 42, color: '#ca8a04' },
      ];
      
      containers.forEach(c => {
        // Container shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(c.x + 4, c.y + 4, 60, 25);
        
        // Container body
        ctx.fillStyle = c.color;
        ctx.fillRect(c.x, c.y, 60, 25);
        
        // Container ridges
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(c.x + 12 + i * 12, c.y);
          ctx.lineTo(c.x + 12 + i * 12, c.y + 25);
          ctx.stroke();
        }
      });
    }
    
    // Airport environment - runway lights
    if (currentEnvironment === 'airport' && env.hasRunwayLights) {
      const time = Date.now() * 0.002;
      ctx.fillStyle = '#22d3ee';
      
      for (let i = 0; i < 10; i++) {
        const lightOn = Math.sin(time + i * 0.5) > 0;
        if (lightOn) {
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(50 + i * 80, CANVAS_HEIGHT - 8, 4, 0, Math.PI * 2);
          ctx.fill();
          
          // Glow
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.arc(50 + i * 80, CANVAS_HEIGHT - 8, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    
    // Cold storage - frost on edges
    if (currentEnvironment === 'cold_storage' && env.frostyWindshield) {
      ctx.fillStyle = 'rgba(200, 230, 255, 0.15)';
      
      // Frost corners
      const frostGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 150);
      frostGrad.addColorStop(0, 'rgba(200, 230, 255, 0.3)');
      frostGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = frostGrad;
      ctx.fillRect(0, 0, 150, 150);
      
      const frostGrad2 = ctx.createRadialGradient(CANVAS_WIDTH, 0, 0, CANVAS_WIDTH, 0, 150);
      frostGrad2.addColorStop(0, 'rgba(200, 230, 255, 0.3)');
      frostGrad2.addColorStop(1, 'transparent');
      ctx.fillStyle = frostGrad2;
      ctx.fillRect(CANVAS_WIDTH - 150, 0, 150, 150);
    }
    
    // Construction - dirt/dust overlay
    if (currentEnvironment === 'construction' && env.dusty) {
      ctx.fillStyle = 'rgba(140, 110, 70, 0.08)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Dust particles floating
      const time = Date.now() * 0.001;
      ctx.fillStyle = 'rgba(180, 150, 100, 0.3)';
      for (let i = 0; i < 30; i++) {
        const x = (i * 43 + time * 15) % CANVAS_WIDTH;
        const y = 100 + Math.sin(time * 0.5 + i) * 200;
        ctx.globalAlpha = 0.1 + Math.sin(i + time) * 0.1;
        ctx.beginPath();
        ctx.arc(x, y, 2 + i % 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  };

  const drawHUD = (ctx) => {
    // Game mode indicator (top center)
    if (gameMode !== 'standard') {
      const mode = GAME_MODES[gameMode];
      ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
      ctx.beginPath();
      ctx.roundRect(CANVAS_WIDTH / 2 - 70, 10, 140, 24, 4);
      ctx.fill();
      
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`${mode?.icon} ${mode?.name}`, CANVAS_WIDTH / 2, 26);
    }
    
    // Mirror mode indicator
    if (levelConfig.mirrored) {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
      ctx.beginPath();
      ctx.roundRect(CANVAS_WIDTH - 90, 70, 80, 20, 4);
      ctx.fill();
      
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#8b5cf6';
      ctx.textAlign = 'center';
      ctx.fillText('🪞 MIRRORED', CANVAS_WIDTH - 50, 84);
    }
    
    // Slippery surface indicator
    const hudTruckForHazard = truckRef.current;
    if (hudTruckForHazard) {
      const allObs = [...(levelConfig.obstacles || []), ...movingObstaclesRef.current];
      let onHazard = null;
      for (const obs of allObs) {
        if (obs.type === 'oilslick' || obs.type === 'puddle') {
          const obsW = obs.width || (obs.type === 'oilslick' ? 60 : 50);
          const obsH = obs.height || (obs.type === 'oilslick' ? 40 : 35);
          const dx = hudTruckForHazard.x - obs.x;
          const dy = hudTruckForHazard.y - obs.y;
          if ((dx * dx) / (obsW * obsW / 4) + (dy * dy) / (obsH * obsH / 4) < 1) {
            onHazard = obs.type;
            break;
          }
        }
      }
      if (onHazard) {
        const pulseAlpha = 0.6 + Math.sin(Date.now() / 150) * 0.3;
        ctx.fillStyle = onHazard === 'oilslick' 
          ? `rgba(147, 51, 234, ${pulseAlpha * 0.3})`
          : `rgba(59, 130, 246, ${pulseAlpha * 0.3})`;
        ctx.beginPath();
        ctx.roundRect(CANVAS_WIDTH / 2 - 55, 50, 110, 22, 4);
        ctx.fill();
        
        ctx.strokeStyle = onHazard === 'oilslick' ? '#9333ea' : '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillStyle = onHazard === 'oilslick' ? '#c084fc' : '#60a5fa';
        ctx.textAlign = 'center';
        ctx.fillText(onHazard === 'oilslick' ? '⚠️ OIL SLICK!' : '💧 SLIPPERY!', CANVAS_WIDTH / 2, 65);
      }
    }
    
    // Conditions indicator (bottom right)
    if (currentWeather !== 'clear' || timeOfDay !== 'noon') {
      ctx.fillStyle = 'rgba(10, 10, 12, 0.7)';
      ctx.beginPath();
      ctx.roundRect(CANVAS_WIDTH - 120, CANVAS_HEIGHT - 35, 110, 25, 4);
      ctx.fill();
      
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = THEME.uiTextMuted;
      ctx.textAlign = 'center';
      
      let conditionText = '';
      if (currentWeather === 'snow') conditionText += '❄️';
      if (timeOfDay !== 'noon') {
        const timeIcons = { dawn: '🌅', morning: '🌤️', afternoon: '🌤️', dusk: '🌇', night: '🌙' };
        conditionText += (conditionText ? ' ' : '') + (timeIcons[timeOfDay] || '');
      }
      ctx.fillText(conditionText, CANVAS_WIDTH - 65, CANVAS_HEIGHT - 18);
      
      if (currentWeather === 'snow') {
        ctx.fillStyle = THEME.uiWarning;
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillText('LOW GRIP', CANVAS_WIDTH - 65, CANVAS_HEIGHT - 8);
      }
    }
    
    // Environment indicator (top left corner, small)
    if (currentEnvironment !== 'warehouse') {
      const env = ENVIRONMENTS[currentEnvironment];
      ctx.font = '14px sans-serif';
      ctx.fillText(env?.icon || '', 110, 25);
    }
    
    // Top left - Timer panel
    ctx.fillStyle = 'rgba(10, 10, 12, 0.8)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 90, 55, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    const currentTimeRemaining = timeRemainingRef.current;
    if (currentTimeRemaining !== null) {
      const isLow = currentTimeRemaining < 10;
      const isCritical = currentTimeRemaining < 5;
      
      // Timer value
      ctx.fillStyle = isCritical ? THEME.uiDanger : isLow ? THEME.uiWarning : THEME.uiText;
      ctx.font = 'bold 32px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(currentTimeRemaining).toString().padStart(2, '0'), 55, 42);
      
      // Pulsing effect when critical
      if (isCritical) {
        ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 100) * 0.2;
        ctx.fillStyle = THEME.uiDanger;
        ctx.beginPath();
        ctx.arc(55, 35, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      
      // Label
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = THEME.uiTextMuted;
      ctx.fillText('TIME', 55, 56);
    } else {
      ctx.fillStyle = THEME.uiTextMuted;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NO LIMIT', 55, 38);
    }
    
    // Top right - Collision counter
    const currentCollisions = collisionsRef.current;
    ctx.fillStyle = 'rgba(10, 10, 12, 0.8)';
    ctx.beginPath();
    ctx.roundRect(CANVAS_WIDTH - 100, 10, 90, 55, 6);
    ctx.fill();
    ctx.strokeStyle = currentCollisions > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = currentCollisions > 0 ? THEME.uiDanger : THEME.uiTextMuted;
    ctx.font = 'bold 32px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(currentCollisions.toString(), CANVAS_WIDTH - 55, 42);
    
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = THEME.uiTextMuted;
    ctx.fillText('COLLISIONS', CANVAS_WIDTH - 55, 56);
    
    // Bottom left - Level info
    ctx.fillStyle = 'rgba(10, 10, 12, 0.7)';
    ctx.beginPath();
    ctx.roundRect(10, CANVAS_HEIGHT - 50, 150, 40, 6);
    ctx.fill();
    
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillStyle = THEME.uiText;
    ctx.textAlign = 'left';
    ctx.fillText(levelConfig.name, 20, CANVAS_HEIGHT - 30);
    
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = THEME.uiTextMuted;
    ctx.fillText(levelConfig.subtitle, 20, CANVAS_HEIGHT - 17);
    
    // Bottom right - Speedometer
    const currentTruck = truckRef.current;
    if (currentTruck) {
      const speed = Math.abs(currentTruck.speed);
      const isReverse = currentTruck.speed < -1;
      
      ctx.fillStyle = 'rgba(10, 10, 12, 0.7)';
      ctx.beginPath();
      ctx.roundRect(CANVAS_WIDTH - 110, CANVAS_HEIGHT - 50, 100, 40, 6);
      ctx.fill();
      
      // Speed value
      ctx.fillStyle = isReverse ? THEME.uiWarning : THEME.uiText;
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(speed)}`, CANVAS_WIDTH - 45, CANVAS_HEIGHT - 23);
      
      // Unit
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = THEME.uiTextMuted;
      ctx.fillText('MPH', CANVAS_WIDTH - 20, CANVAS_HEIGHT - 23);
      
      // Gear indicator
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = isReverse ? THEME.uiWarning : currentTruck.speed > 1 ? THEME.uiSuccess : THEME.uiTextMuted;
      ctx.textAlign = 'left';
      ctx.fillText(isReverse ? 'R' : currentTruck.speed > 1 ? 'D' : 'N', CANVAS_WIDTH - 100, CANVAS_HEIGHT - 23);
      
      // Steering indicator
      const steerPercent = Math.round((currentTruck.steerAngle / (Math.PI / 4)) * 100);
      if (Math.abs(steerPercent) > 5) {
        ctx.fillStyle = THEME.uiAccent;
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${steerPercent > 0 ? '→' : '←'} ${Math.abs(steerPercent)}%`, CANVAS_WIDTH - 60, CANVAS_HEIGHT - 38);
      }
    }
    
    // Center top - Target score indicator
    const targetScore = levelConfig.targetScore;
    ctx.fillStyle = 'rgba(10, 10, 12, 0.6)';
    ctx.beginPath();
    ctx.roundRect(CANVAS_WIDTH / 2 - 50, 10, 100, 25, 4);
    ctx.fill();
    
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = THEME.uiTextMuted;
    ctx.textAlign = 'center';
    ctx.fillText(`TARGET: ${targetScore}`, CANVAS_WIDTH / 2, 27);
    
    // Pull-ups counter (top center-left)
    const currentPullUps = pullUpsRef.current;
    const levelMaxPullUps = getMaxPullUps(currentLevel);
    ctx.fillStyle = 'rgba(10, 10, 12, 0.6)';
    ctx.beginPath();
    ctx.roundRect(CANVAS_WIDTH / 2 - 160, 10, 100, 25, 4);
    ctx.fill();
    
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = currentPullUps > levelMaxPullUps ? THEME.uiDanger : currentPullUps >= levelMaxPullUps ? THEME.uiWarning : currentPullUps > 0 ? THEME.uiWarning : THEME.uiTextMuted;
    ctx.textAlign = 'center';
    ctx.fillText(`PULL-UPS: ${currentPullUps}/${levelMaxPullUps}`, CANVAS_WIDTH / 2 - 110, 27);
    
    // Visual alignment meter (bottom center)
    const hudTruck = truckRef.current;
    if (hudTruck) {
      const dock = levelConfig.dock;
      const angleDiff = Math.abs(normalizeAngle(hudTruck.angle - dock.angle - Math.PI / 2)) * (180 / Math.PI);
      const alignPercent = Math.max(0, 100 - angleDiff * 5);
      
      // Background panel
      ctx.fillStyle = 'rgba(10, 10, 12, 0.7)';
      ctx.beginPath();
      ctx.roundRect(CANVAS_WIDTH / 2 - 80, CANVAS_HEIGHT - 55, 160, 45, 6);
      ctx.fill();
      
      // Label
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = THEME.uiTextMuted;
      ctx.textAlign = 'center';
      ctx.fillText('DOCK ALIGNMENT', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 42);
      
      // Meter background
      ctx.fillStyle = '#1a1a1e';
      ctx.beginPath();
      ctx.roundRect(CANVAS_WIDTH / 2 - 60, CANVAS_HEIGHT - 32, 120, 16, 3);
      ctx.fill();
      
      // Meter zones (red -> yellow -> green)
      const meterWidth = 120;
      const greenZone = 20; // 10% on each side
      const yellowZone = 30;
      
      // Draw zones
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.fillRect(CANVAS_WIDTH / 2 - 60, CANVAS_HEIGHT - 32, meterWidth, 16);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.fillRect(CANVAS_WIDTH / 2 - 60 + yellowZone, CANVAS_HEIGHT - 32, meterWidth - yellowZone * 2, 16);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
      ctx.fillRect(CANVAS_WIDTH / 2 - 60 + (meterWidth - greenZone) / 2, CANVAS_HEIGHT - 32, greenZone, 16);
      
      // Center tick
      ctx.fillStyle = THEME.uiText;
      ctx.fillRect(CANVAS_WIDTH / 2 - 1, CANVAS_HEIGHT - 34, 2, 20);
      
      // Indicator needle
      const normalizedAngle = normalizeAngle(hudTruck.angle - dock.angle - Math.PI / 2);
      const needlePos = CANVAS_WIDTH / 2 + (normalizedAngle / (Math.PI / 4)) * 60;
      const clampedNeedle = Math.max(CANVAS_WIDTH / 2 - 55, Math.min(CANVAS_WIDTH / 2 + 55, needlePos));
      
      // Needle color based on alignment
      ctx.fillStyle = alignPercent > 90 ? THEME.uiSuccess : alignPercent > 60 ? THEME.uiWarning : THEME.uiDanger;
      ctx.beginPath();
      ctx.moveTo(clampedNeedle, CANVAS_HEIGHT - 34);
      ctx.lineTo(clampedNeedle - 5, CANVAS_HEIGHT - 40);
      ctx.lineTo(clampedNeedle + 5, CANVAS_HEIGHT - 40);
      ctx.closePath();
      ctx.fill();
      
      // Percentage text
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = alignPercent > 90 ? THEME.uiSuccess : alignPercent > 60 ? THEME.uiWarning : THEME.uiDanger;
      ctx.fillText(`${Math.round(alignPercent)}%`, CANVAS_WIDTH / 2 + 70, CANVAS_HEIGHT - 20);
      
      // === LOAD WEIGHT & TRACTION INDICATOR (bottom left) ===
      const loadWeight = hudTruck.loadWeight || 0;
      const loadPercent = loadWeight / PHYSICS.maxLoadWeight;
      const friction = hudTruck.surfaceFriction || 1.0;
      
      // Background panel
      ctx.fillStyle = 'rgba(10, 10, 12, 0.7)';
      ctx.beginPath();
      ctx.roundRect(170, CANVAS_HEIGHT - 50, 130, 40, 6);
      ctx.fill();
      
      // Load weight bar
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = THEME.uiTextMuted;
      ctx.textAlign = 'left';
      ctx.fillText('LOAD', 178, CANVAS_HEIGHT - 36);
      
      // Load bar background
      ctx.fillStyle = '#1a1a1e';
      ctx.fillRect(210, CANVAS_HEIGHT - 42, 80, 8);
      
      // Load bar fill
      const loadColor = loadPercent > 0.8 ? THEME.uiDanger : loadPercent > 0.5 ? THEME.uiWarning : THEME.uiSuccess;
      ctx.fillStyle = loadColor;
      ctx.fillRect(210, CANVAS_HEIGHT - 42, 80 * loadPercent, 8);
      
      // Load weight text
      ctx.fillStyle = THEME.uiText;
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(loadWeight / 1000)}k lbs`, 290, CANVAS_HEIGHT - 35);
      
      // Traction indicator
      ctx.textAlign = 'left';
      ctx.fillStyle = THEME.uiTextMuted;
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText('GRIP', 178, CANVAS_HEIGHT - 18);
      
      // Traction bar background
      ctx.fillStyle = '#1a1a1e';
      ctx.fillRect(210, CANVAS_HEIGHT - 24, 80, 8);
      
      // Traction bar fill
      const tractionColor = friction < 0.5 ? THEME.uiDanger : friction < 0.8 ? THEME.uiWarning : THEME.uiSuccess;
      ctx.fillStyle = tractionColor;
      ctx.fillRect(210, CANVAS_HEIGHT - 24, 80 * friction, 8);
      
      // Traction percentage
      ctx.fillStyle = THEME.uiText;
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(friction * 100)}%`, 290, CANVAS_HEIGHT - 17);
      
      // Wheel spin warning
      const wheelSpin = hudTruck.wheelSpin || 0;
      if (wheelSpin > 0.3) {
        ctx.fillStyle = `rgba(245, 158, 11, ${0.5 + wheelSpin * 0.5})`;
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ WHEEL SPIN', 235, CANVAS_HEIGHT - 55);
      }
    }
    
    // Accessibility: Control hints (when enabled)
    if (accessibility.showControlHints) {
      ctx.fillStyle = 'rgba(10, 10, 12, 0.6)';
      ctx.beginPath();
      ctx.roundRect(CANVAS_WIDTH / 2 - 120, CANVAS_HEIGHT - 25, 240, 20, 4);
      ctx.fill();
      
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.textAlign = 'center';
      ctx.fillText('W/S: Drive • A/D: Steer • SPACE: Brake • R: Restart • M: Mute • ESC: Pause', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 12);
    }
  };

  const drawDockLockAnimation = (ctx) => {
    const dock = levelConfig.dock;
    const progress = dockLockAnimationRef.current;
    
    ctx.save();
    ctx.translate(dock.x, dock.y);
    ctx.rotate(dock.angle);
    
    // Expanding ring effect
    const ringRadius = 20 + progress * 80;
    const ringAlpha = Math.max(0, 0.6 - progress * 0.6);
    
    ctx.strokeStyle = `rgba(34, 197, 94, ${ringAlpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Second ring (delayed)
    if (progress > 0.2) {
      const ring2Radius = 20 + (progress - 0.2) * 100;
      const ring2Alpha = Math.max(0, 0.4 - (progress - 0.2) * 0.5);
      ctx.strokeStyle = `rgba(34, 197, 94, ${ring2Alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, ring2Radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Central flash
    const flashGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 60 * progress);
    flashGrad.addColorStop(0, `rgba(255, 255, 255, ${0.8 * (1 - progress)})`);
    flashGrad.addColorStop(0.3, `rgba(34, 197, 94, ${0.5 * (1 - progress)})`);
    flashGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = flashGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 60 * progress, 0, Math.PI * 2);
    ctx.fill();
    
    // Lock icon
    if (progress > 0.5) {
      const iconAlpha = (progress - 0.5) * 2;
      ctx.fillStyle = `rgba(34, 197, 94, ${iconAlpha})`;
      ctx.font = 'bold 24px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', 0, -50);
      
      ctx.fillStyle = `rgba(255, 255, 255, ${iconAlpha * 0.9})`;
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillText('LOCKED', 0, -70);
    }
    
    // Hydraulic lock bars animation
    const barExtend = Math.min(1, progress * 2);
    ctx.fillStyle = THEME.chrome;
    
    // Left bar
    ctx.save();
    ctx.translate(-dock.width / 2 - 15, 0);
    ctx.fillRect(-5, -4, 10 * barExtend, 8);
    ctx.restore();
    
    // Right bar
    ctx.save();
    ctx.translate(dock.width / 2 + 15, 0);
    ctx.fillRect(-10 * barExtend + 5, -4, 10 * barExtend, 8);
    ctx.restore();
    
    ctx.restore();
  };

  // Touch controls
  const handleJoystickStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    joystickDataRef.current = {
      startX: centerX,
      startY: centerY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      angle: 0,
      magnitude: 0
    };
    setJoystickData(joystickDataRef.current);
  };

  const handleJoystickMove = (e) => {
    if (!joystickDataRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    
    const dx = touch.clientX - joystickDataRef.current.startX;
    const dy = touch.clientY - joystickDataRef.current.startY;
    const magnitude = Math.min(Math.sqrt(dx * dx + dy * dy) / 50, 1);
    const angle = Math.atan2(dy, dx);
    
    const updated = {
      ...joystickDataRef.current,
      currentX: touch.clientX,
      currentY: touch.clientY,
      angle,
      magnitude
    };
    joystickDataRef.current = updated;
    setJoystickData(updated);
  };

  const handleJoystickEnd = () => {
    joystickDataRef.current = null; setJoystickData(null);
  };

  // Render
  if (gameState === 'menu') {
    // In embedded mode, menu is never shown — startGame fires on mount and
    // transitions straight to countdown. Render null during that brief window
    // so the parent background never bleeds through as a white flash.
    if (embedded) return null;

    const playerLevel = getPlayerLevel(stats.totalXP);
    const levelProgress = getLevelProgress(stats.totalXP);
    const nextLevel = XP_LEVELS.find(l => l.level === playerLevel.level + 1);
    
    // Accessibility-adjusted colors
    const bgColor = getAccessibleColor('uiBg') || THEME.uiBg;
    const textColor = getAccessibleColor('uiText') || THEME.uiText;
    const mutedColor = getAccessibleColor('uiTextMuted') || THEME.uiTextMuted;
    const accentColor = getAccessibleColor('uiAccent') || THEME.uiAccent;
    const successColor = getAccessibleColor('success') || THEME.uiSuccess;
    const dangerColor = getAccessibleColor('danger') || THEME.uiDanger;
    
    // Font size multiplier for large text mode
    const fontScale = accessibility.largeText ? 1.25 : 1;
    
    return (
      <div 
        style={{
          width: '100%',
          maxWidth: 900,
          margin: '0 auto',
          padding: useTouch ? '12px 10px' : 20,
          backgroundColor: bgColor,
          minHeight: '100vh',
          fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
          color: textColor,
          animation: menuAnimated && !accessibility.reducedMotion ? 'fadeIn 0.5s ease' : 'none',
          opacity: menuAnimated ? 1 : 0,
          fontSize: `${fontScale * 100}%`
        }}
        role="main"
        aria-label="Dock Master Game Menu"
      >
        {/* Skip to main content link for screen readers */}
        <a 
          href="#level-selection"
          style={{
            position: 'absolute',
            left: -9999,
            top: 'auto',
            width: 1,
            height: 1,
            overflow: 'hidden'
          }}
          onFocus={(e) => e.target.style.cssText = 'position:fixed;left:10px;top:10px;width:auto;height:auto;padding:10px;background:#3b82f6;color:#fff;z-index:1000;'}
          onBlur={(e) => e.target.style.cssText = 'position:absolute;left:-9999px;'}
        >
          Skip to Level Selection
        </a>
        
        {/* Header */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: 30, 
          paddingTop: 20,
          animation: menuAnimated && !accessibility.reducedMotion ? 'fadeInDown 0.6s ease' : 'none'
        }}>
          <div style={{
            fontSize: 12,
            letterSpacing: 6,
            color: THEME.uiTextMuted,
            marginBottom: 8
          }}>PRECISION PARKING</div>
          <h1 style={{
            fontSize: 'clamp(28px, 6vw, 48px)',
            fontWeight: 800,
            margin: 0,
            background: `linear-gradient(135deg, ${THEME.uiText} 0%, ${THEME.uiAccent} 50%, ${THEME.uiTextMuted} 100%)`,
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: -2,
            animation: menuAnimated && !accessibility.reducedMotion ? 'shimmer 3s ease infinite' : 'none'
          }}>DOCK MASTER</h1>
          <div style={{
            fontSize: 14,
            color: THEME.uiTextMuted,
            marginTop: 8
          }}>Box Truck Boss</div>
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.3)',
            marginTop: 4,
            letterSpacing: 2
          }}>v1.0</div>
        </div>

        {/* Player Stats Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          backgroundColor: THEME.uiCard,
          border: `1px solid ${THEME.uiBorder}`,
          borderRadius: 10,
          marginBottom: 24,
          animation: menuAnimated ? 'fadeInUp 0.5s ease 0.1s both' : 'none'
        }}>
          {/* Player Level */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 36, animation: 'bounce 2s ease infinite' }}>{playerLevel.icon}</span>
            <div>
              <div style={{ fontSize: 11, color: THEME.uiTextMuted, letterSpacing: 1 }}>DRIVER RANK</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{playerLevel.name}</div>
            </div>
          </div>
          
          {/* XP Bar */}
          <div style={{ flex: 1, maxWidth: 300, margin: '0 30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: THEME.uiTextMuted }}>Level {playerLevel.level}</span>
              <span style={{ fontSize: 11, color: THEME.uiTextMuted }}>
                {stats.totalXP} / {nextLevel ? nextLevel.xpRequired : 'MAX'} XP
              </span>
            </div>
            <div style={{
              height: 8,
              backgroundColor: '#1a1a1e',
              borderRadius: 4,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${levelProgress * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                borderRadius: 4,
                transition: 'width 0.5s'
              }} />
            </div>
          </div>
          
          {/* Quick Stats */}
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: THEME.uiTextMuted }}>STARS</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                ⭐ {stats.totalStars}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: THEME.uiTextMuted }}>DOCKS</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{stats.successfulDocks}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: THEME.uiTextMuted }}>PERFECT</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: THEME.uiSuccess }}>{stats.perfectDocks}</div>
            </div>
          </div>
        </div>


        {/* Level Grid */}
        <div 
          id="level-selection"
          role="region"
          aria-label="Level Selection"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 30,
            animation: menuAnimated && !accessibility.reducedMotion ? 'fadeInUp 0.5s ease 0.2s both' : 'none'
          }}
        >
          {Object.entries(LEVEL_CONFIGS).map(([num, config], index) => {
            const levelNum = parseInt(num);
            const isUnlocked = unlockedLevels.includes(levelNum);
            const highScore = highScores[levelNum];
            const stars = levelStars[levelNum] || 0;
            const par = LEVEL_PARS[levelNum];
            const isHovered = buttonHover === `level-${num}`;
            
            return (
              <button
                key={num}
                onClick={() => isUnlocked && startGame(levelNum)}
                onMouseEnter={() => setButtonHover(`level-${num}`)}
                onMouseLeave={() => setButtonHover(null)}
                onFocus={() => setButtonHover(`level-${num}`)}
                onBlur={() => setButtonHover(null)}
                disabled={!isUnlocked}
                aria-label={`Level ${num}: ${config.name}. ${config.difficulty} difficulty. ${isUnlocked ? (highScore ? `Best score: ${highScore}. ${stars} stars.` : 'Not completed yet.') : 'Locked.'}`}
                aria-disabled={!isUnlocked}
                tabIndex={isUnlocked ? 0 : -1}
                style={{
                  padding: 16,
                  backgroundColor: isHovered && isUnlocked ? THEME.uiCardHover : (isUnlocked ? THEME.uiCard : '#0a0a0c'),
                  border: `2px solid ${isHovered && isUnlocked ? THEME.uiAccent : (isUnlocked ? THEME.uiBorder : '#1a1a1e')}`,
                  borderRadius: 8,
                  outline: 'none',
                  cursor: isUnlocked ? 'pointer' : 'not-allowed',
                  opacity: isUnlocked ? 1 : 0.4,
                  textAlign: 'left',
                  transition: 'all 0.25s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  transform: isHovered && isUnlocked ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
                  boxShadow: isHovered && isUnlocked ? '0 8px 25px rgba(59, 130, 246, 0.2)' : 'none',
                  animation: menuAnimated ? `slideInLeft 0.4s ease ${0.05 * index}s both` : 'none'
                }}
              >
                {/* Hover glow effect */}
                {isHovered && isUnlocked && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, transparent 60%)',
                    pointerEvents: 'none'
                  }} />
                )}
                {/* Star display */}
                {isUnlocked && (
                  <div style={{ 
                    position: 'absolute', 
                    top: 8, 
                    right: 8,
                    display: 'flex',
                    gap: 2
                  }}>
                    {[1, 2, 3].map(s => (
                      <span 
                        key={s} 
                        style={{ 
                          fontSize: 14,
                          opacity: s <= stars ? 1 : 0.2,
                          transform: s <= stars ? 'scale(1)' : 'scale(0.8)',
                          transition: 'all 0.3s ease'
                        }}
                      >⭐</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: THEME.uiText
                  }}>{num.padStart(2, '0')}</span>
                  <span style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    backgroundColor: config.difficulty === 'ELITE' ? THEME.uiDanger :
                                     config.difficulty === 'PRO' ? THEME.uiWarning :
                                     config.difficulty === 'STANDARD' ? THEME.uiAccent : THEME.uiSuccess,
                    color: '#fff',
                    borderRadius: 4,
                    fontWeight: 600
                  }}>{config.difficulty}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: THEME.uiText, marginBottom: 2 }}>
                  {config.name}
                </div>
                <div style={{ fontSize: 11, color: THEME.uiTextMuted, marginBottom: 4 }}>
                  {config.subtitle}
                </div>
                {/* Load and conditions */}
                <div style={{ 
                  display: 'flex', 
                  gap: 8, 
                  flexWrap: 'wrap',
                  fontSize: 9,
                  color: THEME.uiTextMuted
                }}>
                  {config.loadWeight > 0 && (
                    <span>📦 {(config.loadWeight / 1000).toFixed(0)}k lbs</span>
                  )}
                  {config.nightMode && <span>🌙</span>}
                  {config.environment && ENVIRONMENTS[config.environment] && (
                    <span>{ENVIRONMENTS[config.environment].icon}</span>
                  )}
                  {config.weather === 'snow' && <span>❄️</span>}
                  {par && <span>⏱️ Par {par.time}s</span>}
                </div>
                {highScore && (
                  <div style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    fontSize: 20,
                    fontWeight: 800,
                    color: highScore >= 95 ? THEME.uiGold : highScore >= 85 ? THEME.uiSuccess : THEME.uiAccent
                  }}>{highScore}</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Special Mode Start Buttons */}
        {gameMode === 'time_attack' && (
          <button
            onClick={() => startGame(1)}
            style={{
              width: '100%',
              padding: 20,
              backgroundColor: THEME.uiCard,
              border: '2px solid #f59e0b',
              borderRadius: 8,
              cursor: 'pointer',
              marginBottom: 20
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
              ⏱️ START TIME ATTACK
            </div>
            <div style={{ fontSize: 12, color: THEME.uiTextMuted }}>
              15 seconds per dock • +5s bonus per completion
            </div>
          </button>
        )}

        {/* Quick Play - Random Level */}
        {gameMode === 'standard' && unlockedLevels.length > 0 && (
          <button
            onClick={() => {
              // Pick random unlocked level - level config sets environment/weather
              const randomLevel = unlockedLevels[Math.floor(Math.random() * unlockedLevels.length)];
              startGame(randomLevel);
            }}
            style={{
              width: '100%',
              padding: 16,
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              border: '2px solid #8b5cf6',
              borderRadius: 8,
              cursor: 'pointer',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10
            }}
          >
            <span style={{ fontSize: 24 }}>🎲</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#a78bfa' }}>
                QUICK PLAY
              </div>
              <div style={{ fontSize: 11, color: THEME.uiTextMuted }}>
                Random level
              </div>
            </div>
          </button>
        )}

        {/* Endless Mode */}
        {unlockedLevels.length === 8 && gameMode === 'standard' && (
          <button
            onClick={() => {
              setEndlessStreak(0);
              startGame('endless');
            }}
            style={{
              width: '100%',
              padding: 20,
              backgroundColor: THEME.uiCard,
              border: `2px solid ${THEME.uiGold}`,
              borderRadius: 8,
              cursor: 'pointer',
              marginBottom: 30
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: THEME.uiGold, marginBottom: 4 }}>
              ∞ ENDLESS MODE
            </div>
            <div style={{ fontSize: 12, color: THEME.uiTextMuted }}>
              Best Streak: {stats.bestEndlessStreak}
            </div>
          </button>
        )}

        {/* Game Mode Selector */}
        <div style={{
          marginBottom: 24,
          padding: 16,
          backgroundColor: THEME.uiCard,
          borderRadius: 8,
          border: `1px solid ${THEME.uiBorder}`
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 12
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>
              🎮 GAME MODE
            </div>
            <div style={{ 
              fontSize: 12, 
              color: GAME_MODES[gameMode]?.id === 'standard' ? THEME.uiTextMuted : THEME.uiAccent,
              fontWeight: 600
            }}>
              {GAME_MODES[gameMode]?.icon} {GAME_MODES[gameMode]?.name}
            </div>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 8
          }}>
            {Object.values(GAME_MODES).map(mode => (
              <button
                key={mode.id}
                onClick={() => setGameMode(mode.id)}
                style={{
                  padding: 12,
                  backgroundColor: gameMode === mode.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${gameMode === mode.id ? '#3b82f6' : THEME.uiBorder}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>{mode.icon}</div>
                <div style={{ 
                  fontSize: 10, 
                  fontWeight: 600,
                  color: gameMode === mode.id ? '#3b82f6' : THEME.uiText
                }}>
                  {mode.name}
                </div>
              </button>
            ))}
          </div>
          
          {/* Mode description */}
          <div style={{
            marginTop: 12,
            padding: 10,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderRadius: 6,
            fontSize: 11,
            color: THEME.uiTextMuted,
            textAlign: 'center'
          }}>
            {GAME_MODES[gameMode]?.description}
          </div>
        </div>


        {/* Career Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          padding: 16,
          backgroundColor: THEME.uiCard,
          borderRadius: 8,
          border: `1px solid ${THEME.uiBorder}`
        }}>
          {[
            { label: 'TOTAL XP', value: stats.totalXP, color: '#3b82f6' },
            { label: 'TOTAL STARS', value: stats.totalStars, icon: '⭐' },
            { label: 'PERFECT DOCKS', value: stats.perfectDocks, color: THEME.uiSuccess },
            { label: 'BEST STREAK', value: stats.bestEndlessStreak, color: THEME.uiGold }
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 800, 
                color: stat.color || THEME.uiText 
              }}>
                {stat.icon || ''}{stat.value}
              </div>
              <div style={{ fontSize: 9, color: THEME.uiTextMuted, letterSpacing: 1 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Truck Customization */}
        <div style={{
          marginTop: 20,
          padding: 16,
          backgroundColor: THEME.uiCard,
          borderRadius: 8,
          border: `1px solid ${THEME.uiBorder}`
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: showCustomization ? 16 : 0
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🚚</span> YOUR TRUCK
            </div>
            <button
              onClick={() => setShowCustomization(!showCustomization)}
              style={{
                padding: '6px 12px',
                backgroundColor: showCustomization ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: `1px solid ${showCustomization ? '#3b82f6' : THEME.uiBorder}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
                color: showCustomization ? '#3b82f6' : THEME.uiTextMuted
              }}
            >
              {showCustomization ? 'CLOSE' : 'CUSTOMIZE'}
            </button>
          </div>
          
          {showCustomization && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Live Truck Preview - Overhead View (matches in-game) */}
              <div style={{
                padding: 15,
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: 8,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 10, color: THEME.uiTextMuted, marginBottom: 8 }}>
                  OVERHEAD PREVIEW
                </div>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: 90,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* SVG Overhead Truck Preview - matches canvas drawTruck */}
                  <svg width="220" height="85" viewBox="0 0 240 80" style={{ overflow: 'visible' }}>
                    {/* Ground shadow */}
                    <ellipse cx="120" cy="44" rx="108" ry="28" fill="rgba(0,0,0,0.15)" />
                    
                    {/* === BOX TRAILER === */}
                    <rect x="64" y="12" width="134" height="56" rx="3" fill="#e8e8ec" />
                    {/* Vertical ribs */}
                    {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                      <line key={`rib${i}`} x1={74 + i * 10} y1="12" x2={74 + i * 10} y2="68" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
                    ))}
                    {/* Top edge highlight */}
                    <rect x="64" y="12" width="134" height="2" fill="rgba(255,255,255,0.5)" />
                    {/* Bottom edge shadow */}
                    <rect x="64" y="66" width="134" height="2" fill="rgba(0,0,0,0.12)" />
                    {/* Box border */}
                    <rect x="64" y="12" width="134" height="56" rx="3" fill="none" stroke="#9ca3af" strokeWidth="1" />
                    {/* Rear door frame */}
                    <rect x="192" y="16" width="4" height="48" rx="1" fill="#c0c0c8" />
                    <rect x="193" y="34" width="2" height="12" rx="0.5" fill="#808088" />
                    
                    {/* === CAB === */}
                    <rect x="18" y="16" width="48" height="48" rx="8" fill={TRUCK_COLORS[truckCustomization.color]?.primary || '#3b82f6'} />
                    {/* Cab darker side accent */}
                    <path d="M18,24 L18,56 Q18,64 26,64 L26,16 Q18,16 18,24 Z" fill={TRUCK_COLORS[truckCustomization.color]?.secondary || '#2563eb'} />
                    
                    {/* Windshield */}
                    <rect x="20" y="20" width="16" height="40" rx="3" fill="#0f172a" />
                    <rect x="21" y="21" width="14" height="38" rx="2" fill="#1e3a5f" />
                    {/* Windshield reflection */}
                    <rect x="22" y="24" width="4" height="20" rx="1" fill="rgba(255,255,255,0.1)" />
                    
                    {/* Side window */}
                    <rect x="38" y="20" width="12" height="12" rx="2" fill="#1e3a5f" />
                    <rect x="38" y="48" width="12" height="12" rx="2" fill="#1e3a5f" />
                    
                    {/* Cab top highlight */}
                    <line x1="30" y1="17" x2="64" y2="17" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                    
                    {/* === DECALS - mapped from canvas coordinates === */}
                    {/* Canvas: cabFront=-65, cabBack=-27, cabY=-18, ch=36 */}
                    {/* SVG: cab x=18 w=48, flame region x=18..70, cab y=16 h=48 */}
                    {truckCustomization.decal === 'flames' && (
                      <>
                        {/* Top flame: hugs upper edge */}
                        <path d="M21,17 L29,17 Q59,16 67,23 Q56,26 48,29 Q37,31 21,29 Z" fill="#f97316" opacity="0.75" />
                        {/* Center flame: largest, sweeps through middle */}
                        <path d="M21,31 L32,31 Q65,29 73,39 Q65,44 56,42 Q37,49 21,47 Z" fill="#f97316" opacity="0.75" />
                        {/* Bottom flame: hugs lower edge */}
                        <path d="M21,50 L29,50 Q59,49 67,55 Q56,54 48,60 Q37,63 21,62 Z" fill="#f97316" opacity="0.75" />
                        {/* Top bright core */}
                        <path d="M23,19 Q45,18 48,23 Q40,27 23,27 Z" fill="#fbbf24" opacity="0.45" />
                        {/* Center bright core */}
                        <path d="M23,34 Q48,32 54,39 Q43,44 23,44 Z" fill="#fbbf24" opacity="0.45" />
                        {/* Bottom bright core */}
                        <path d="M23,52 Q45,51 48,55 Q40,59 23,59 Z" fill="#fbbf24" opacity="0.45" />
                      </>
                    )}
                    {truckCustomization.decal === 'stripes' && (
                      <>
                        {/* Two racing stripes at 35% and 55% of cab height, full cab width */}
                        <rect x="18" y="33" width="48" height="4" rx="1" fill="white" opacity="0.7" />
                        <rect x="18" y="42" width="48" height="4" rx="1" fill="white" opacity="0.7" />
                      </>
                    )}
                    {truckCustomization.decal === 'checkered' && (
                      <g>
                        {/* 7 cols × 6 rows covering entire cab roof, matching canvas grid */}
                        {[0,1,2,3,4,5].map(row => [0,1,2,3,4,5,6].map(col => {
                          const cellW = 48 / 7;
                          const cellH = 48 / 6;
                          return (
                            <rect key={`chk${row}-${col}`} 
                              x={18 + col * cellW} y={16 + row * cellH} 
                              width={cellW} height={cellH} 
                              fill={(row + col) % 2 === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(30,30,30,0.6)'} />
                          );
                        }))}
                      </g>
                    )}
                    
                    {/* Roof marker lights */}
                    <circle cx="30" cy="17" r="2" fill="#dc2626" />
                    <circle cx="38" cy="17" r="2" fill="#dc2626" />
                    <circle cx="46" cy="17" r="2" fill="#fbbf24" />
                    <circle cx="54" cy="17" r="2" fill="#dc2626" />
                    <circle cx="30" cy="63" r="2" fill="#dc2626" />
                    <circle cx="38" cy="63" r="2" fill="#dc2626" />
                    <circle cx="46" cy="63" r="2" fill="#fbbf24" />
                    <circle cx="54" cy="63" r="2" fill="#dc2626" />
                    
                    {/* === WHEELS === */}
                    <rect x="28" y="6" width="14" height="8" rx="2" fill="#1a1a1e" />
                    <rect x="29" y="7" width="12" height="6" rx="1.5" fill="#2a2a2e" />
                    <rect x="28" y="66" width="14" height="8" rx="2" fill="#1a1a1e" />
                    <rect x="29" y="67" width="12" height="6" rx="1.5" fill="#2a2a2e" />
                    <rect x="176" y="6" width="14" height="8" rx="2" fill="#1a1a1e" />
                    <rect x="177" y="7" width="12" height="6" rx="1.5" fill="#2a2a2e" />
                    <rect x="176" y="66" width="14" height="8" rx="2" fill="#1a1a1e" />
                    <rect x="177" y="67" width="12" height="6" rx="1.5" fill="#2a2a2e" />
                    
                    {/* Side mirrors */}
                    <rect x="34" y="4" width="8" height="4" rx="1" fill="#374151" />
                    <rect x="35" y="5" width="6" height="2" rx="0.5" fill="rgba(148,163,184,0.4)" />
                    <rect x="34" y="72" width="8" height="4" rx="1" fill="#374151" />
                    <rect x="35" y="73" width="6" height="2" rx="0.5" fill="rgba(148,163,184,0.4)" />
                    
                    {/* Headlights */}
                    <circle cx="20" cy="22" r="3.5" fill="#fef9c3" />
                    <circle cx="20" cy="22" r="2" fill="#fde68a" />
                    <circle cx="20" cy="58" r="3.5" fill="#fef9c3" />
                    <circle cx="20" cy="58" r="2" fill="#fde68a" />
                    
                    {/* Tail lights */}
                    <rect x="196" y="16" width="3" height="8" rx="1" fill="#dc2626" />
                    <rect x="196" y="56" width="3" height="8" rx="1" fill="#dc2626" />
                    
                    {/* Chrome grille bars */}
                    <rect x="18" y="26" width="3" height="4" rx="0.5" fill="#d1d5db" />
                    <rect x="18" y="50" width="3" height="4" rx="0.5" fill="#d1d5db" />
                    
                    {/* Fuel tanks */}
                    <rect x="60" y="10" width="8" height="4" rx="1.5" fill="#374151" />
                    <rect x="60" y="66" width="8" height="4" rx="1.5" fill="#374151" />
                    
                    {/* === ACCESSORY VISUALS === */}
                    {truckCustomization.accessories.includes('lightbar') && (
                      <>
                        <rect x="24" y="10" width="20" height="4" rx="1" fill="#374151" />
                        <rect x="26" y="11" width="4" height="2" rx="0.5" fill="#fbbf24" />
                        <rect x="32" y="11" width="4" height="2" rx="0.5" fill="#fbbf24" />
                        <rect x="38" y="11" width="4" height="2" rx="0.5" fill="#fbbf24" />
                        <rect x="24" y="66" width="20" height="4" rx="1" fill="#374151" />
                        <rect x="26" y="67" width="4" height="2" rx="0.5" fill="#fbbf24" />
                        <rect x="32" y="67" width="4" height="2" rx="0.5" fill="#fbbf24" />
                        <rect x="38" y="67" width="4" height="2" rx="0.5" fill="#fbbf24" />
                      </>
                    )}
                    {truckCustomization.accessories.includes('mudflaps') && (
                      <>
                        <rect x="190" y="6" width="6" height="8" rx="1" fill="#1f2937" />
                        <line x1="191" y1="9" x2="195" y2="9" stroke="#374151" strokeWidth="1" />
                        <rect x="190" y="66" width="6" height="8" rx="1" fill="#1f2937" />
                        <line x1="191" y1="69" x2="195" y2="69" stroke="#374151" strokeWidth="1" />
                      </>
                    )}
                    
                    {/* Decal label on trailer */}
                    {truckCustomization.decal && truckCustomization.decal !== 'none' && (
                      <text x="130" y="43" fontSize="10" fill="rgba(255,255,255,0.8)" textAnchor="middle" fontWeight="bold">
                        {DECALS[truckCustomization.decal]?.name || ''}
                      </text>
                    )}
                  </svg>
                </div>
                <div style={{ fontSize: 10, color: THEME.uiTextMuted, marginTop: 5 }}>
                  {TRUCK_COLORS[truckCustomization.color]?.name || 'Blue'} 
                  {truckCustomization.decal && truckCustomization.decal !== 'none' && 
                    ` • ${DECALS[truckCustomization.decal]?.name}`}
                </div>
                
                {/* Unlock Progress */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: 15, 
                  marginTop: 10,
                  fontSize: 9,
                  color: THEME.uiTextMuted
                }}>
                  <span>🎨 {Object.values(TRUCK_COLORS).filter(c => !c.hidden).length} colors</span>
                  <span>✨ {Object.keys(DECALS).length} decals</span>
                  <span>🔧 {Object.keys(ACCESSORIES).length} accessories</span>
                </div>
              </div>
              
              {/* Color Selection */}
              <div>
                <div style={{ fontSize: 11, color: THEME.uiTextMuted, marginBottom: 8 }}>
                  CAB COLOR
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.values(TRUCK_COLORS).filter(c => !c.hidden).map(color => {
                    const isUnlocked = color.unlocked || unlockedCustomizations.colors.includes(color.id);
                    const isSelected = truckCustomization.color === color.id;
                    const canAfford = stats.totalXP >= (color.xpCost || 0);
                    return (
                      <button
                        key={color.id}
                        onClick={() => isUnlocked && setTruckCustomization(prev => ({ ...prev, color: color.id }))}
                        disabled={!isUnlocked}
                        className="touch-target"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          backgroundColor: color.primary,
                          border: isSelected ? '3px solid #fff' : '2px solid transparent',
                          cursor: isUnlocked ? 'pointer' : 'not-allowed',
                          opacity: isUnlocked ? 1 : 0.4,
                          boxShadow: isSelected ? '0 0 10px rgba(255,255,255,0.5)' : 'none',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title={`${color.name}${!isUnlocked ? ` • ${color.unlockCondition}${color.xpCost ? ` • ${color.xpCost} XP` : ''}` : ''}`}
                      >
                        {!isUnlocked && (
                          <span style={{ 
                            fontSize: 12, 
                            color: canAfford ? '#fbbf24' : '#ef4444'
                          }}>🔒</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Decals */}
              <div>
                <div style={{ fontSize: 11, color: THEME.uiTextMuted, marginBottom: 8 }}>
                  DECAL
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.values(DECALS).map(decal => {
                    const isUnlocked = decal.unlocked || unlockedCustomizations.decals?.includes(decal.id);
                    const isSelected = truckCustomization.decal === decal.id;
                    return (
                      <button
                        key={decal.id}
                        onClick={() => isUnlocked && setTruckCustomization(prev => ({ ...prev, decal: decal.id }))}
                        disabled={!isUnlocked}
                        className="touch-target"
                        style={{
                          padding: '8px 12px',
                          minHeight: 36,
                          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                          border: `1px solid ${isSelected ? '#3b82f6' : THEME.uiBorder}`,
                          borderRadius: 6,
                          cursor: isUnlocked ? 'pointer' : 'not-allowed',
                          opacity: isUnlocked ? 1 : 0.4,
                          fontSize: 11,
                          color: isSelected ? '#3b82f6' : THEME.uiTextMuted
                        }}
                        title={!isUnlocked ? `${decal.unlockCondition}${decal.xpCost ? ` • ${decal.xpCost} XP` : ''}` : decal.name}
                      >
                        {!isUnlocked ? '🔒 ' : ''}{decal.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Accessories */}
              <div>
                <div style={{ fontSize: 11, color: THEME.uiTextMuted, marginBottom: 8 }}>
                  ACCESSORIES ({Object.keys(ACCESSORIES).length} total)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                  {Object.values(ACCESSORIES).map(acc => {
                    const isUnlocked = acc.unlocked || unlockedCustomizations.accessories?.includes(acc.id);
                    const isEquipped = truckCustomization.accessories.includes(acc.id);
                    return (
                      <button
                        key={acc.id}
                        onClick={() => {
                          if (!isUnlocked) return;
                          setTruckCustomization(prev => ({
                            ...prev,
                            accessories: isEquipped 
                              ? prev.accessories.filter(a => a !== acc.id)
                              : [...prev.accessories, acc.id]
                          }));
                        }}
                        disabled={!isUnlocked}
                        className="touch-target"
                        style={{
                          padding: '8px 12px',
                          minHeight: 36,
                          backgroundColor: isEquipped ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                          border: `1px solid ${isEquipped ? '#22c55e' : THEME.uiBorder}`,
                          borderRadius: 6,
                          cursor: isUnlocked ? 'pointer' : 'not-allowed',
                          opacity: isUnlocked ? 1 : 0.4,
                          fontSize: 11,
                          color: isEquipped ? '#22c55e' : THEME.uiTextMuted
                        }}
                        title={!isUnlocked ? `${acc.unlockCondition}${acc.xpCost ? ` • ${acc.xpCost} XP` : ''}` : acc.name}
                      >
                        {!isUnlocked ? '🔒' : isEquipped ? '✓' : ''} {acc.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              
            </div>
          )}
        </div>

        {/* Controls hint */}
        <div style={{
          marginTop: 30,
          padding: 16,
          backgroundColor: THEME.uiCard,
          borderRadius: 8,
          fontSize: 12,
          color: THEME.uiTextMuted,
          textAlign: 'center'
        }}>
          {isMobile ? (
            mobileControlType === 'dpad' 
              ? 'Swipe D-Pad to drive • Tap center to brake • 🔄 to restart'
              : 'Rotate wheel to steer • Tap pedals to drive/brake'
          ) : (
            'WASD / Arrows to drive • SPACE to brake • R to restart • M to mute • C for camera • ESC to pause'
          )}
        </div>

        {/* Sound toggle */}
        <button
          onClick={() => setMuted(!muted)}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: THEME.uiCard,
            border: `1px solid ${THEME.uiBorder}`,
            color: THEME.uiText,
            cursor: 'pointer',
            fontSize: 20
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        
        {/* Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          aria-label="Open settings"
          style={{
            position: 'fixed',
            top: 20,
            right: 74,
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: THEME.uiCard,
            border: `1px solid ${THEME.uiBorder}`,
            color: THEME.uiText,
            cursor: 'pointer',
            fontSize: 20
          }}
        >
          ⚙️
        </button>
        
        {/* Accessibility quick toggle */}
        <button
          onClick={() => setAccessibility(prev => ({
            ...prev,
            reducedMotion: !prev.reducedMotion
          }))}
          aria-label={`Reduced motion: ${accessibility.reducedMotion ? 'On' : 'Off'}. Click to toggle.`}
          title="Toggle reduced motion"
          style={{
            position: 'fixed',
            top: 20,
            right: 128,
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: accessibility.reducedMotion ? 'rgba(139, 92, 246, 0.2)' : THEME.uiCard,
            border: `1px solid ${accessibility.reducedMotion ? '#a78bfa' : THEME.uiBorder}`,
            color: accessibility.reducedMotion ? '#a78bfa' : THEME.uiText,
            cursor: 'pointer',
            fontSize: 20
          }}
        >
          ♿
        </button>
        
        {/* Settings modal */}
        {showSettings && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200
          }}>
            <div style={{
              backgroundColor: THEME.uiCard,
              borderRadius: 12,
              padding: '24px 20px',
              width: 'min(340px, calc(100vw - 32px))',
              border: `1px solid ${THEME.uiBorder}`
            }}>
              <h2 style={{ color: THEME.uiText, marginBottom: 20, fontSize: 22 }}>⚙️ Settings</h2>
              
              {/* Scrollable content */}
              <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
                
                {/* === CONTROLS SECTION === */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ 
                    color: THEME.uiAccent, 
                    fontSize: 11, 
                    fontWeight: 700, 
                    letterSpacing: 1,
                    marginBottom: 12,
                    paddingBottom: 6,
                    borderBottom: `1px solid ${THEME.uiBorder}`
                  }}>
                    🎮 CONTROLS
                  </div>
                  
                  {/* Steering Sensitivity */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ color: THEME.uiTextMuted, fontSize: 11, display: 'block', marginBottom: 6 }}>
                      Steering Sensitivity
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.1"
                        value={steerSensitivity}
                        onChange={(e) => setSteerSensitivity(parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: THEME.uiAccent }}
                      />
                      <span style={{ color: THEME.uiText, width: 42, textAlign: 'right', fontSize: 12 }}>
                        {Math.round(steerSensitivity * 100)}%
                      </span>
                    </div>
                  </div>
                  
                  {/* Camera Shake Intensity */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ color: THEME.uiTextMuted, fontSize: 11, display: 'block', marginBottom: 6 }}>
                      Screen Shake
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.25"
                        value={cameraShakeIntensity}
                        onChange={(e) => setCameraShakeIntensity(parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: THEME.uiAccent }}
                      />
                      <span style={{ color: THEME.uiText, width: 42, textAlign: 'right', fontSize: 12 }}>
                        {cameraShakeIntensity === 0 ? 'Off' : Math.round(cameraShakeIntensity * 100) + '%'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Control Scheme */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ color: THEME.uiTextMuted, fontSize: 11, display: 'block', marginBottom: 6 }}>
                      Control Scheme
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[
                        { id: 'auto', label: 'Auto', icon: '🔄' },
                        { id: 'touch', label: 'Touch', icon: '👆' },
                        { id: 'keyboard', label: 'Keys', icon: '⌨️' }
                      ].map(scheme => (
                        <button
                          key={scheme.id}
                          onClick={() => setControlScheme(scheme.id)}
                          style={{
                            flex: 1,
                            padding: '8px 6px',
                            backgroundColor: controlScheme === scheme.id ? THEME.uiAccent : THEME.uiBg,
                            border: `1px solid ${controlScheme === scheme.id ? THEME.uiAccent : THEME.uiBorder}`,
                            borderRadius: 6,
                            color: controlScheme === scheme.id ? '#fff' : THEME.uiText,
                            fontSize: 10,
                            cursor: 'pointer',
                            fontFamily: 'inherit'
                          }}
                        >
                          <div style={{ fontSize: 16, marginBottom: 2 }}>{scheme.icon}</div>
                          {scheme.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Mobile Control Type */}
                  {(controlScheme === 'touch' || (controlScheme === 'auto' && deviceType === 'mobile')) && (
                    <div>
                      <label style={{ color: THEME.uiTextMuted, fontSize: 11, display: 'block', marginBottom: 6 }}>
                        Mobile Control Type
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setMobileControlType('dpad')}
                          style={{
                            flex: 1,
                            padding: '10px 6px',
                            backgroundColor: mobileControlType === 'dpad' ? '#22c55e' : THEME.uiBg,
                            border: `2px solid ${mobileControlType === 'dpad' ? '#22c55e' : THEME.uiBorder}`,
                            borderRadius: 8,
                            color: mobileControlType === 'dpad' ? '#fff' : THEME.uiText,
                            fontSize: 10,
                            cursor: 'pointer',
                            fontFamily: 'inherit'
                          }}
                        >
                          <div style={{ fontSize: 20, marginBottom: 2 }}>✚</div>
                          <div style={{ fontWeight: 600 }}>D-Pad</div>
                        </button>
                        <button
                          onClick={() => setMobileControlType('wheel')}
                          style={{
                            flex: 1,
                            padding: '10px 6px',
                            backgroundColor: mobileControlType === 'wheel' ? '#f59e0b' : THEME.uiBg,
                            border: `2px solid ${mobileControlType === 'wheel' ? '#f59e0b' : THEME.uiBorder}`,
                            borderRadius: 8,
                            color: mobileControlType === 'wheel' ? '#fff' : THEME.uiText,
                            fontSize: 10,
                            cursor: 'pointer',
                            fontFamily: 'inherit'
                          }}
                        >
                          <div style={{ fontSize: 20, marginBottom: 2 }}>🎮</div>
                          <div style={{ fontWeight: 600 }}>Wheel</div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* === AUDIO SECTION === */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ 
                    color: '#f59e0b', 
                    fontSize: 11, 
                    fontWeight: 700, 
                    letterSpacing: 1,
                    marginBottom: 12,
                    paddingBottom: 6,
                    borderBottom: `1px solid ${THEME.uiBorder}`
                  }}>
                    🔊 AUDIO
                  </div>
                  
                  {/* Master Mute */}
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    cursor: 'pointer'
                  }}>
                    <span style={{ color: THEME.uiText, fontSize: 12 }}>
                      Master Audio
                    </span>
                    <div style={{
                      width: 44,
                      height: 24,
                      backgroundColor: muted ? THEME.uiBorder : THEME.uiSuccess,
                      borderRadius: 12,
                      padding: 2,
                      transition: 'background-color 0.2s',
                      cursor: 'pointer'
                    }}
                    onClick={() => setMuted(!muted)}
                    >
                      <div style={{
                        width: 20,
                        height: 20,
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        transform: muted ? 'translateX(0)' : 'translateX(20px)',
                        transition: 'transform 0.2s'
                      }} />
                    </div>
                  </label>
                  
                  {/* SFX Volume */}
                  <div style={{ marginBottom: 12, opacity: muted ? 0.5 : 1 }}>
                    <label style={{ color: THEME.uiTextMuted, fontSize: 11, display: 'block', marginBottom: 6 }}>
                      Sound Effects
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={sfxVolume}
                        onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                        disabled={muted}
                        style={{ flex: 1, accentColor: '#f59e0b' }}
                      />
                      <span style={{ color: THEME.uiText, width: 42, textAlign: 'right', fontSize: 12 }}>
                        {Math.round(sfxVolume * 100)}%
                      </span>
                    </div>
                  </div>
                  
                </div>
                
                
                {/* === ACCESSIBILITY SECTION === */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ 
                    color: '#a78bfa', 
                    fontSize: 11, 
                    fontWeight: 700, 
                    letterSpacing: 1,
                    marginBottom: 12,
                    paddingBottom: 6,
                    borderBottom: `1px solid ${THEME.uiBorder}`
                  }}>
                    ♿ ACCESSIBILITY
                  </div>
                  
                  {/* Reduced Motion */}
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: 10,
                    cursor: 'pointer'
                  }}>
                    <span style={{ color: THEME.uiText, fontSize: 12 }}>
                      Reduced Motion
                    </span>
                    <input
                      type="checkbox"
                      checked={accessibility.reducedMotion}
                      onChange={(e) => setAccessibility(prev => ({
                        ...prev,
                        reducedMotion: e.target.checked
                      }))}
                      style={{ accentColor: '#a78bfa', width: 18, height: 18 }}
                    />
                  </label>
                  
                  {/* High Contrast */}
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: 10,
                    cursor: 'pointer'
                  }}>
                    <span style={{ color: THEME.uiText, fontSize: 12 }}>
                      High Contrast
                    </span>
                    <input
                      type="checkbox"
                      checked={accessibility.highContrast}
                      onChange={(e) => setAccessibility(prev => ({
                        ...prev,
                        highContrast: e.target.checked
                      }))}
                      style={{ accentColor: '#a78bfa', width: 18, height: 18 }}
                    />
                  </label>
                  
                  {/* Large Text / UI Scale */}
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: 10,
                    cursor: 'pointer'
                  }}>
                    <span style={{ color: THEME.uiText, fontSize: 12 }}>
                      Large UI
                    </span>
                    <input
                      type="checkbox"
                      checked={accessibility.largeText}
                      onChange={(e) => setAccessibility(prev => ({
                        ...prev,
                        largeText: e.target.checked
                      }))}
                      style={{ accentColor: '#a78bfa', width: 18, height: 18 }}
                    />
                  </label>
                  
                  {/* Screen Reader Mode */}
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    cursor: 'pointer'
                  }}>
                    <span style={{ color: THEME.uiText, fontSize: 12 }}>
                      Screen Reader Hints
                    </span>
                    <input
                      type="checkbox"
                      checked={accessibility.screenReaderMode}
                      onChange={(e) => setAccessibility(prev => ({
                        ...prev,
                        screenReaderMode: e.target.checked
                      }))}
                      style={{ accentColor: '#a78bfa', width: 18, height: 18 }}
                    />
                  </label>
                  
                  {/* Performance Mode */}
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    cursor: 'pointer'
                  }}>
                    <div>
                      <span style={{ color: THEME.uiText, fontSize: 12 }}>
                        Performance Mode
                      </span>
                      <div style={{ fontSize: 9, color: THEME.uiTextMuted, marginTop: 2 }}>
                        Reduces effects for slower devices
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={accessibility.performanceMode}
                      onChange={(e) => setAccessibility(prev => ({
                        ...prev,
                        performanceMode: e.target.checked
                      }))}
                      style={{ accentColor: '#22c55e', width: 18, height: 18 }}
                    />
                  </label>
                  
                  {/* Color Blind Mode */}
                  <div>
                    <label style={{ color: THEME.uiTextMuted, fontSize: 11, display: 'block', marginBottom: 6 }}>
                      Color Blind Mode
                    </label>
                    <select
                      value={accessibility.colorBlindMode}
                      onChange={(e) => setAccessibility(prev => ({
                        ...prev,
                        colorBlindMode: e.target.value
                      }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        backgroundColor: THEME.uiBg,
                        border: `1px solid ${THEME.uiBorder}`,
                        borderRadius: 6,
                        color: THEME.uiText,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      <option value="none">None</option>
                      <option value="protanopia">Protanopia (Red-blind)</option>
                      <option value="deuteranopia">Deuteranopia (Green-blind)</option>
                      <option value="tritanopia">Tritanopia (Blue-blind)</option>
                    </select>
                  </div>
                </div>
                
              </div>
              
              {/* Version number */}
              <div style={{
                textAlign: 'center',
                color: THEME.uiTextMuted,
                fontSize: 10,
                marginTop: 12,
                marginBottom: 12,
                opacity: 0.5
              }}>
                Dock Master Minigame v3.0.0
              </div>
              
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  fontSize: 14,
                  backgroundColor: THEME.uiAccent,
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                DONE
              </button>
            </div>
          </div>
        )}
        
      </div>
    );
  }

  // Game view
  // Desktop embedded: position:relative so we flow inside the portal wrapper div
  //   (portal already provides the fixed viewport overlay — no need for another fixed)
  // Mobile embedded or standalone mobile: position:fixed;inset:0 as before
  //   (touch layout requires the game to anchor directly to the viewport)
  // Standalone desktop (not embedded): position:relative, auto height
  const fillScreen = useTouch || embedded;
  const embeddedDesktop = embedded && !useTouch;
  return (
    <div 
      className="dock-game-container"
      style={{
        width: '100%',
        maxWidth: fillScreen ? '100%' : 850,
        margin: 0,
        padding: 0,
        backgroundColor: THEME.uiBg,
        height: fillScreen ? '100vh' : 'auto',
        minHeight: fillScreen ? 0 : '100vh',
        fontFamily: '"JetBrains Mono", monospace',
        position: embeddedDesktop ? 'relative' : (fillScreen ? 'fixed' : 'relative'),
        inset: embeddedDesktop ? 'auto' : (fillScreen ? 0 : 'auto'),
        overflow: 'hidden'
      }}
    >
      {/* Landscape orientation hint for mobile */}
      <div 
        className="landscape-hint"
        style={{
          display: 'none', // CSS will show this in portrait on small screens
          position: 'fixed',
          inset: 0,
          backgroundColor: '#0a0a0e',
          zIndex: 9999,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          textAlign: 'center',
          padding: 40
        }}
      >
        {/* Animated phone rotation icon */}
        <div style={{ 
          fontSize: 80, 
          marginBottom: 30,
          animation: 'rotatePhone 2s ease-in-out infinite'
        }}>
          <style>{`
            @keyframes rotatePhone {
              0%, 100% { transform: rotate(0deg); }
              25% { transform: rotate(-15deg); }
              50% { transform: rotate(90deg); }
              75% { transform: rotate(75deg); }
            }
          `}</style>
          📱
        </div>
        
        <div style={{ 
          fontSize: 24, 
          fontWeight: 800, 
          marginBottom: 12,
          letterSpacing: 2,
          color: '#fbbf24'
        }}>
          ROTATE YOUR DEVICE
        </div>
        
        <div style={{ 
          fontSize: 14, 
          color: 'rgba(255,255,255,0.7)', 
          maxWidth: 300,
          lineHeight: 1.6,
          marginBottom: 30
        }}>
          Dock Master is designed for landscape mode. 
          Please rotate your phone horizontally for the best experience.
        </div>
        
        {/* Visual diagram */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '15px 25px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ 
            width: 40, 
            height: 60, 
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: 'rgba(255,255,255,0.3)'
          }}>
            ✕
          </div>
          <div style={{ fontSize: 24, color: '#fbbf24' }}>→</div>
          <div style={{ 
            width: 60, 
            height: 40, 
            border: '2px solid #22c55e',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: '#22c55e'
          }}>
            ✓
          </div>
        </div>
        
        {/* Lock rotation hint */}
        <div style={{
          marginTop: 30,
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          maxWidth: 280
        }}>
          💡 Tip: Make sure rotation lock is disabled in your device settings
        </div>
      </div>
      
      {/* Game area - flex layout for landscape controls */}
      <div style={{
        width: '100%',
        height: isPortrait ? '100vw' : fillScreen ? '100vh' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: THEME.uiBg,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Left controls area (landscape) */}
        {useTouch && gameState === 'playing' && (
          <div style={{
            position: 'absolute',
            left: 'max(8px, env(safe-area-inset-left, 8px))',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            zIndex: 20
          }}>
            {/* Option buttons - 2x2 grid in wheel mode, vertical in dpad mode */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: mobileControlType === 'wheel' ? 'repeat(2, 1fr)' : '1fr',
              gap: 8
            }}>
              {/* Quick restart */}
              <button
                className="mobile-action-btn"
                onClick={() => {
                  triggerHaptic('medium');
                  setAttempts(prev => prev + 1);
                  setCollisions(0);
                  setPullUps(0);
                  initLevel();
                  setGameState('countdown');
                  setCountdown(3);
                }}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 10,
                  backgroundColor: 'rgba(30, 30, 35, 0.95)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 20,
                  touchAction: 'none',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                }}
              >
                🔄
              </button>
              
              {/* Pause */}
              <button
                className="mobile-action-btn"
                onClick={() => setGameState('paused')}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 10,
                  backgroundColor: 'rgba(30, 30, 35, 0.95)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 20,
                  touchAction: 'none',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                }}
              >
                ⏸
              </button>
              
              {/* Control type toggle */}
              <button
                className="mobile-action-btn"
                onClick={() => {
                  triggerHaptic('light');
                  setMobileControlType(prev => prev === 'dpad' ? 'wheel' : 'dpad');
                }}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 10,
                  backgroundColor: 'rgba(30, 30, 35, 0.95)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 18,
                  touchAction: 'none',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                }}
                title={mobileControlType === 'dpad' ? 'Switch to wheel' : 'Switch to D-Pad'}
              >
                {mobileControlType === 'dpad' ? '🎮' : '✚'}
              </button>
            </div>
            
            {/* Steering Wheel - only in wheel mode */}
            {mobileControlType === 'wheel' && (
              <div
                className="mobile-wheel"
                onTouchStart={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  const touch = e.touches[0];
                  wheelStartAngle.current = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
                  wheelStartRotation.current = wheelAngle;
                  triggerHaptic('light');
                }}
                onTouchMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  const touch = e.touches[0];
                  const currentAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
                  let delta = (currentAngle - wheelStartAngle.current) * (180 / Math.PI);
                  if (delta > 180) delta -= 360;
                  if (delta < -180) delta += 360;
                  const newRotation = Math.max(-150, Math.min(150, wheelStartRotation.current + delta));
                  wheelAngleRef.current = newRotation; setWheelAngle(newRotation);
                }}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(30, 30, 35, 0.95)',
                  border: '4px solid rgba(255,255,255,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `rotate(${wheelAngle}deg)`,
                  touchAction: 'none',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.3)'
                }}
              >
                <div style={{ position: 'absolute', width: '75%', height: 5, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3 }} />
                <div style={{ position: 'absolute', width: 5, height: '75%', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3 }} />
                <div style={{ width: 35, height: 35, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: '3px solid rgba(255,255,255,0.25)' }} />
                <div style={{ position: 'absolute', top: 8, width: 16, height: 5, backgroundColor: THEME.uiAccent, borderRadius: 3 }} />
              </div>
            )}
          </div>
        )}
        
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          role="img"
          aria-label={`Dock backing game. Level ${currentLevel}. ${accessibility.screenReaderMode ? `Score: ${score}. Collisions: ${collisions}. Time: ${timeRemaining || 'unlimited'}.` : 'Use arrow keys or touch controls to navigate truck to dock.'}`}
          tabIndex={0}
          style={{
            // aspect-ratio lets the browser solve the constraint system:
            //   width tries to be 100% of container
            //   max-height:100vh caps the height to the viewport
            //   aspect-ratio:800/600 ensures ratio is preserved within both limits
            // Result on 1920x900: canvas = 1200x900 (not 1920x1440 clipped) ✅
            // Result on mobile (useTouch): keep existing auto-sizing with side padding
            display: 'block',
            width: '100%',
            height: 'auto',
            maxWidth: useTouch ? 'calc(100% - 140px)' : '100%',
            maxHeight: isPortrait ? '100vw' : '100vh',
            aspectRatio: '800 / 600',
            objectFit: 'contain',
            outline: 'none',
            touchAction: 'none',
            margin: '0 auto',
            willChange: 'transform',
            imageRendering: 'pixelated',
            transform: 'translateZ(0)',
          }}
          onKeyDown={(e) => {
            if (e.key === '?' && accessibility.screenReaderMode) {
              const announcement = `Level ${currentLevel}. Score: ${score}. Collisions: ${collisions}. ${timeRemaining ? `Time remaining: ${timeRemaining} seconds.` : ''}`;
              const liveRegion = document.getElementById('game-announcer');
              if (liveRegion) liveRegion.textContent = announcement;
            }
          }}
        />
        
        {/* Right controls area - D-Pad or Pedals */}
        {useTouch && gameState === 'playing' && (
          <div style={{
            position: 'absolute',
            right: 'max(10px, env(safe-area-inset-right, 10px))',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 20
          }}>
            {mobileControlType === 'dpad' ? (
              /* D-Pad */
              <div
                className="mobile-dpad"
                style={{
                  width: 140,
                  height: 140,
                  touchAction: 'none'
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const rect = e.currentTarget.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  const dx = touch.clientX - centerX;
                  const dy = touch.clientY - centerY;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  
                  dpadTouchId.current = touch.identifier;
                  triggerHaptic('light');
                  
                  if (distance < 25) {
                    dpadStateRef.current = {up: false, down: false, left: false, right: false, brake: true }; setDpadState({up: false, down: false, left: false, right: false, brake: true });
                  } else {
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    // 8-way detection with 45° sectors for diagonals
                    // Diagonals activate BOTH directions for fluid movement
                    const up = angle < -22.5 && angle > -157.5;
                    const down = angle > 22.5 && angle < 157.5;
                    const left = angle > 112.5 || angle < -112.5;
                    const right = angle > -67.5 && angle < 67.5;
                    dpadStateRef.current = {up, down, left, right, brake: false }; setDpadState({up, down, left, right, brake: false });
                  }
                }}
                onTouchMove={(e) => {
                  e.preventDefault();
                  const touch = Array.from(e.touches).find(t => t.identifier === dpadTouchId.current);
                  if (!touch) return;
                  
                  const rect = e.currentTarget.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  const dx = touch.clientX - centerX;
                  const dy = touch.clientY - centerY;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  
                  if (distance < 25) {
                    dpadStateRef.current = {up: false, down: false, left: false, right: false, brake: true }; setDpadState({up: false, down: false, left: false, right: false, brake: true });
                  } else {
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    // 8-way detection with 45° sectors for diagonals
                    const up = angle < -22.5 && angle > -157.5;
                    const down = angle > 22.5 && angle < 157.5;
                    const left = angle > 112.5 || angle < -112.5;
                    const right = angle > -67.5 && angle < 67.5;
                    dpadStateRef.current = {up, down, left, right, brake: false }; setDpadState({up, down, left, right, brake: false });
                  }
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  dpadTouchId.current = null;
                  dpadStateRef.current = {up: false, down: false, left: false, right: false, brake: false }; setDpadState({up: false, down: false, left: false, right: false, brake: false });
                }}
              >
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="68" fill="rgba(30, 30, 35, 0.95)" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                  
                  {/* Up arrow */}
                  <path d="M70 12 L82 38 L58 38 Z" 
                    fill={dpadState.up && !dpadState.left && !dpadState.right ? THEME.uiSuccess : 'rgba(255,255,255,0.25)'} 
                    stroke={dpadState.up ? THEME.uiSuccess : 'rgba(255,255,255,0.15)'} 
                    strokeWidth="2" />
                  
                  {/* Up-Right diagonal */}
                  <path d="M108 32 L118 18 L132 32 L118 42 Z" 
                    fill={dpadState.up && dpadState.right ? THEME.uiSuccess : 'rgba(255,255,255,0.15)'} 
                    stroke={dpadState.up && dpadState.right ? THEME.uiSuccess : 'rgba(255,255,255,0.1)'} 
                    strokeWidth="1" />
                  
                  {/* Right arrow */}
                  <path d="M128 70 L102 82 L102 58 Z" 
                    fill={dpadState.right && !dpadState.up && !dpadState.down ? THEME.uiAccent : 'rgba(255,255,255,0.25)'} 
                    stroke={dpadState.right ? THEME.uiAccent : 'rgba(255,255,255,0.15)'} 
                    strokeWidth="2" />
                  
                  {/* Down-Right diagonal */}
                  <path d="M108 108 L118 122 L132 108 L118 98 Z" 
                    fill={dpadState.down && dpadState.right ? THEME.uiWarning : 'rgba(255,255,255,0.15)'} 
                    stroke={dpadState.down && dpadState.right ? THEME.uiWarning : 'rgba(255,255,255,0.1)'} 
                    strokeWidth="1" />
                  
                  {/* Down arrow */}
                  <path d="M70 128 L82 102 L58 102 Z" 
                    fill={dpadState.down && !dpadState.left && !dpadState.right ? THEME.uiWarning : 'rgba(255,255,255,0.25)'} 
                    stroke={dpadState.down ? THEME.uiWarning : 'rgba(255,255,255,0.15)'} 
                    strokeWidth="2" />
                  
                  {/* Down-Left diagonal */}
                  <path d="M32 108 L22 122 L8 108 L22 98 Z" 
                    fill={dpadState.down && dpadState.left ? THEME.uiWarning : 'rgba(255,255,255,0.15)'} 
                    stroke={dpadState.down && dpadState.left ? THEME.uiWarning : 'rgba(255,255,255,0.1)'} 
                    strokeWidth="1" />
                  
                  {/* Left arrow */}
                  <path d="M12 70 L38 82 L38 58 Z" 
                    fill={dpadState.left && !dpadState.up && !dpadState.down ? THEME.uiAccent : 'rgba(255,255,255,0.25)'} 
                    stroke={dpadState.left ? THEME.uiAccent : 'rgba(255,255,255,0.15)'} 
                    strokeWidth="2" />
                  
                  {/* Up-Left diagonal */}
                  <path d="M32 32 L22 18 L8 32 L22 42 Z" 
                    fill={dpadState.up && dpadState.left ? THEME.uiSuccess : 'rgba(255,255,255,0.15)'} 
                    stroke={dpadState.up && dpadState.left ? THEME.uiSuccess : 'rgba(255,255,255,0.1)'} 
                    strokeWidth="1" />
                  
                  {/* Center brake button */}
                  <circle cx="70" cy="70" r="20" 
                    fill={dpadState.brake ? THEME.uiDanger : 'rgba(255,255,255,0.08)'} 
                    stroke={dpadState.brake ? THEME.uiDanger : 'rgba(255,255,255,0.2)'} 
                    strokeWidth="2" />
                  <text x="70" y="74" textAnchor="middle" fill={dpadState.brake ? '#fff' : 'rgba(255,255,255,0.4)'} fontSize="9" fontWeight="bold">
                    STOP
                  </text>
                </svg>
              </div>
            ) : (
              /* Pedals only - wheel is on left side */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                {/* Forward pedal */}
                <button
                  className="mobile-pedal"
                  onTouchStart={(e) => { e.preventDefault(); triggerHaptic('light'); pedalStateRef.current = {...pedalStateRef.current, drive: true}; setPedalState(p => ({...p, drive: true})); }}
                  onTouchEnd={() => { pedalStateRef.current = {...pedalStateRef.current, drive: false}; setPedalState(p => ({...p, drive: false})); }}
                  style={{
                    width: 90,
                    height: 60,
                    backgroundColor: pedalState.drive ? THEME.uiSuccess : 'rgba(30, 30, 35, 0.95)',
                    border: `3px solid ${THEME.uiSuccess}`,
                    borderRadius: 12,
                    color: pedalState.drive ? '#fff' : THEME.uiSuccess,
                    fontSize: 14,
                    fontWeight: 700,
                    touchAction: 'none',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                  }}
                >
                  ▲ FWD
                </button>
                
                {/* Brake pedal */}
                <button
                  className="mobile-pedal"
                  onTouchStart={(e) => { e.preventDefault(); triggerHaptic('light'); pedalStateRef.current = {...pedalStateRef.current, brake: true}; setPedalState(p => ({...p, brake: true})); }}
                  onTouchEnd={() => { pedalStateRef.current = {...pedalStateRef.current, brake: false}; setPedalState(p => ({...p, brake: false})); }}
                  style={{
                    width: 90,
                    height: 50,
                    backgroundColor: pedalState.brake ? THEME.uiDanger : 'rgba(30, 30, 35, 0.95)',
                    border: `3px solid ${THEME.uiDanger}`,
                    borderRadius: 12,
                    color: pedalState.brake ? '#fff' : THEME.uiDanger,
                    fontSize: 13,
                    fontWeight: 700,
                    touchAction: 'none',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                  }}
                >
                  ■ STOP
                </button>
                
                {/* Reverse pedal */}
                <button
                  className="mobile-pedal"
                  onTouchStart={(e) => { e.preventDefault(); triggerHaptic('light'); pedalStateRef.current = {...pedalStateRef.current, reverse: true}; setPedalState(p => ({...p, reverse: true})); }}
                  onTouchEnd={() => { pedalStateRef.current = {...pedalStateRef.current, reverse: false}; setPedalState(p => ({...p, reverse: false})); }}
                  style={{
                    width: 90,
                    height: 60,
                    backgroundColor: pedalState.reverse ? THEME.uiWarning : 'rgba(30, 30, 35, 0.95)',
                    border: `3px solid ${THEME.uiWarning}`,
                    borderRadius: 12,
                    color: pedalState.reverse ? '#fff' : THEME.uiWarning,
                    fontSize: 14,
                    fontWeight: 700,
                    touchAction: 'none',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                  }}
                >
                  ▼ REV
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Screen reader live region */}
      <div 
        id="game-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: -9999,
          width: 1,
          height: 1,
          overflow: 'hidden'
        }}
      />
      
      {/* Pause button during gameplay */}
      {gameState === 'playing' && (
        <div style={{
          position: 'absolute',
          top: 75,
          left: 10,
          display: 'flex',
          gap: 6
        }}>
          <button
            onClick={() => setGameState('paused')}
            aria-label="Pause game"
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              backgroundColor: 'rgba(10, 10, 12, 0.7)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: THEME.uiText,
              cursor: 'pointer',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ⏸
          </button>
          <button
            onClick={() => {
              setAttempts(prev => prev + 1);
              setCollisions(0);
              setPullUps(0);
              initLevel();
              setGameState('countdown');
              setCountdown(3);
            }}
            aria-label="Restart level"
            title="Restart (R)"
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              backgroundColor: 'rgba(10, 10, 12, 0.7)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: THEME.uiText,
              cursor: 'pointer',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ↻
          </button>
        </div>
      )}
      
      {/* Tutorial overlay for level 1 */}
      {(() => {
        // Touch users get 6 steps (includes controller-options step); keyboard users get 5
        const totalSteps = useTouch ? 6 : 5;
        const lastStep = totalSteps - 1;
        if (!(gameState === 'playing' && currentLevel === 1 && tutorialStep < totalSteps)) return null;

        // For touch: steps 0-1 same, step 2 = NEW controller options, steps 3-5 = old 2-4
        // For keyboard: steps 0-4 same as before
        const getStepContent = () => {
          if (tutorialStep === 0) return (
            <>
              <div style={{ color: THEME.uiAccent, fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>STEP 1 of {totalSteps}</div>
              <div style={{ color: THEME.uiText, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Welcome, Driver!</div>
              <div style={{ color: THEME.uiTextMuted, fontSize: 13, marginBottom: 0, lineHeight: 1.6 }}>
                Back the truck into the <span style={{ color: THEME.uiAccent }}>loading dock</span> at the top of the screen. The rear of the truck must enter first.
              </div>
            </>
          );

          if (tutorialStep === 1) {
            if (useTouch) return (
              <>
                <div style={{ color: THEME.uiAccent, fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>STEP 2 of {totalSteps}</div>
                <div style={{ color: THEME.uiText, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Two Control Styles</div>
                <div style={{ color: THEME.uiTextMuted, fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>
                  You have <span style={{ color: '#22c55e', fontWeight: 700 }}>two ways to drive</span> — switch anytime with the <span style={{ color: THEME.uiText }}>🎮 / ✚</span> button on the left panel.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 0 }}>
                  <div style={{
                    flex: 1, padding: '8px 6px', borderRadius: 8,
                    backgroundColor: mobileControlType === 'dpad' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${mobileControlType === 'dpad' ? '#22c55e' : 'rgba(255,255,255,0.12)'}`,
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 3 }}>✚</div>
                    <div style={{ color: '#22c55e', fontSize: 11, fontWeight: 700 }}>D-PAD</div>
                    <div style={{ color: THEME.uiTextMuted, fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>Thumb-pad style — swipe to steer &amp; drive</div>
                  </div>
                  <div style={{
                    flex: 1, padding: '8px 6px', borderRadius: 8,
                    backgroundColor: mobileControlType === 'wheel' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${mobileControlType === 'wheel' ? '#f59e0b' : 'rgba(255,255,255,0.12)'}`,
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 3 }}>🎮</div>
                    <div style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700 }}>WHEEL</div>
                    <div style={{ color: THEME.uiTextMuted, fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>Spin the wheel, use pedals for gas &amp; reverse</div>
                  </div>
                </div>
              </>
            );
            // keyboard step 1 = reverse controls
            return (
              <>
                <div style={{ color: THEME.uiAccent, fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>STEP 2 of {totalSteps}</div>
                <div style={{ color: THEME.uiText, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Reverse Controls</div>
                <div style={{ color: THEME.uiTextMuted, fontSize: 13, marginBottom: 0, lineHeight: 1.6 }}>
                  Press <span style={{ color: THEME.uiText }}>S</span> or <span style={{ color: THEME.uiText }}>↓</span> to reverse.
                  The <span style={{ color: '#fbbf24' }}>rear</span> of your truck needs to enter the dock.
                </div>
              </>
            );
          }

          // Touch step 2 = reverse; keyboard step 2 = steering
          if (tutorialStep === 2) {
            if (useTouch) return (
              <>
                <div style={{ color: THEME.uiAccent, fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>STEP 3 of {totalSteps}</div>
                <div style={{ color: THEME.uiText, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Reverse Controls</div>
                <div style={{ color: THEME.uiTextMuted, fontSize: 13, marginBottom: 0, lineHeight: 1.6 }}>
                  {mobileControlType === 'dpad'
                    ? <>Swipe <span style={{ color: THEME.uiWarning }}>down</span> on the D-pad to reverse. The <span style={{ color: '#fbbf24' }}>rear</span> of your truck enters the dock.</>
                    : <>Press the <span style={{ color: THEME.uiWarning }}>REV</span> pedal to reverse. The <span style={{ color: '#fbbf24' }}>rear</span> of your truck enters the dock.</>
                  }
                </div>
              </>
            );
            return (
              <>
                <div style={{ color: THEME.uiAccent, fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>STEP 3 of {totalSteps}</div>
                <div style={{ color: THEME.uiText, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Steering While Reversing</div>
                <div style={{ color: THEME.uiTextMuted, fontSize: 13, marginBottom: 0, lineHeight: 1.6 }}>
                  When reversing: steer <span style={{ color: THEME.uiText }}>LEFT (A)</span> to swing the rear RIGHT.
                  Steer <span style={{ color: THEME.uiText }}>RIGHT (D)</span> to swing the rear LEFT.
                </div>
              </>
            );
          }

          // Touch step 3 = steering; keyboard step 3 = alignment
          if (tutorialStep === 3) {
            if (useTouch) return (
              <>
                <div style={{ color: THEME.uiAccent, fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>STEP 4 of {totalSteps}</div>
                <div style={{ color: THEME.uiText, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Steering While Reversing</div>
                <div style={{ color: THEME.uiTextMuted, fontSize: 13, marginBottom: 0, lineHeight: 1.6 }}>
                  {mobileControlType === 'dpad'
                    ? <>Swipe left/right on the D-pad to steer. When reversing, the <span style={{ color: '#fbbf24' }}>rear</span> swings the same direction you steer.</>
                    : <>Rotate the <span style={{ color: THEME.uiText }}>steering wheel</span>. When reversing, turn the wheel the direction you want the <span style={{ color: '#fbbf24' }}>rear</span> to go.</>
                  }
                </div>
              </>
            );
            return (
              <>
                <div style={{ color: THEME.uiAccent, fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>STEP 4 of {totalSteps}</div>
                <div style={{ color: THEME.uiText, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Watch the Alignment</div>
                <div style={{ color: THEME.uiTextMuted, fontSize: 13, marginBottom: 0, lineHeight: 1.6 }}>
                  The <span style={{ color: '#22c55e' }}>alignment meter</span> at the bottom shows your angle.
                  Keep the needle <span style={{ color: '#22c55e' }}>centered and green</span> to dock perfectly.
                </div>
              </>
            );
          }

          // Touch step 4 = alignment; keyboard step 4 = ready
          if (tutorialStep === 4) {
            if (useTouch) return (
              <>
                <div style={{ color: THEME.uiAccent, fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>STEP 5 of {totalSteps}</div>
                <div style={{ color: THEME.uiText, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Watch the Alignment</div>
                <div style={{ color: THEME.uiTextMuted, fontSize: 13, marginBottom: 0, lineHeight: 1.6 }}>
                  The <span style={{ color: '#22c55e' }}>alignment meter</span> shows your angle.
                  Keep the needle <span style={{ color: '#22c55e' }}>centered and green</span> to dock perfectly.
                </div>
              </>
            );
            return (
              <>
                <div style={{ color: THEME.uiAccent, fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>STEP 5 of {totalSteps}</div>
                <div style={{ color: THEME.uiText, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>You're Ready!</div>
                <div style={{ color: THEME.uiTextMuted, fontSize: 13, marginBottom: 0, lineHeight: 1.6 }}>
                  Back slowly into the dock. Stop when aligned.
                  Press <span style={{ color: THEME.uiText }}>ESC</span> to pause, <span style={{ color: THEME.uiText }}>R</span> to restart.
                </div>
              </>
            );
          }

          // Touch step 5 = ready
          return (
            <>
              <div style={{ color: THEME.uiAccent, fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>STEP 6 of {totalSteps}</div>
              <div style={{ color: THEME.uiText, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>You're Ready!</div>
              <div style={{ color: THEME.uiTextMuted, fontSize: 13, marginBottom: 0, lineHeight: 1.6 }}>
                Back slowly into the dock. Stop when aligned.
                Tap <span style={{ color: THEME.uiText }}>⏸</span> to pause or the <span style={{ color: THEME.uiText }}>↻</span> button to restart.
              </div>
            </>
          );
        };

        return (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(10, 10, 12, 0.97)',
            border: `2px solid ${THEME.uiAccent}`,
            borderRadius: 14,
            padding: '18px 20px',
            width: 'min(340px, 88vw)',
            textAlign: 'center',
            zIndex: 50,
            boxShadow: '0 8px 40px rgba(0,0,0,0.7)'
          }}>
            {getStepContent()}

            {/* Action buttons */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setTutorialStep(prev => prev + 1)}
                style={{
                  width: '100%',
                  minHeight: 48,
                  fontSize: 14,
                  backgroundColor: THEME.uiAccent,
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  letterSpacing: 0.5
                }}
              >
                {tutorialStep < lastStep ? 'NEXT →' : 'START DOCKING 🚛'}
              </button>

              {tutorialStep === 0 && (
                <button
                  onClick={() => setTutorialStep(totalSteps)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: THEME.uiTextMuted,
                    fontSize: 12,
                    cursor: 'pointer',
                    opacity: 0.7,
                    padding: '8px 16px',
                    minHeight: 44,
                    fontFamily: 'inherit'
                  }}
                >
                  🚛 Experienced driver? Skip the tutorial.
                </button>
              )}
            </div>
          </div>
        );
      })()}
      
      {/* Countdown overlay */}
      {gameState === 'countdown' && countdown !== null && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20
          }}>
            {/* Level name */}
            <div style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: 'uppercase'
            }}>
              {levelConfig.name}
            </div>
            
            {/* Countdown number */}
            <div style={{
              fontSize: countdown === 'GO' ? 120 : 150,
              fontWeight: 900,
              color: countdown === 'GO' ? THEME.uiSuccess : '#fff',
              textShadow: countdown === 'GO' 
                ? `0 0 40px ${THEME.uiSuccess}, 0 0 80px ${THEME.uiSuccess}`
                : '0 0 30px rgba(255,255,255,0.5)',
              animation: 'countdownPulse 0.8s ease-out',
              fontFamily: 'system-ui, sans-serif'
            }}>
              {countdown}
            </div>
            
            {/* Subtitle */}
            <div style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 14,
              letterSpacing: 1
            }}>
              {countdown === 'GO' ? 'GOOD LUCK!' : 'GET READY'}
            </div>
            
            {/* Tip of the level */}
            {countdown !== 'GO' && LEVEL_TIPS[currentLevel] && (
              <div style={{
                marginTop: 10,
                padding: '12px 20px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 8,
                maxWidth: 'min(320px, calc(100vw - 40px))',
                textAlign: 'center'
              }}>
                <div style={{ color: THEME.uiAccent, fontSize: 10, fontWeight: 600, marginBottom: 6 }}>
                  💡 TIP
                </div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 1.4 }}>
                  {LEVEL_TIPS[currentLevel]?.[0] || 'Take it slow and use your mirrors'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pause overlay */}
      {gameState === 'paused' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: THEME.uiText,
          zIndex: 100,
          animation: 'fadeIn 0.3s ease',
          backdropFilter: 'blur(5px)'
        }}>
          <h2 style={{ 
            fontSize: 32, 
            marginBottom: 30,
            animation: 'scaleIn 0.3s ease'
          }}>⏸️ PAUSED</h2>
          
          {/* Keyboard Shortcuts */}
          <div style={{
            marginBottom: 20,
            padding: 16,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 8,
            width: 'min(280px, calc(100vw - 40px))',
            animation: !accessibility.reducedMotion ? 'fadeInUp 0.4s ease 0.2s both' : 'none'
          }}>
            <div style={{ fontSize: 12, color: THEME.uiTextMuted, marginBottom: 10 }}>
              ⌨️ KEYBOARD SHORTCUTS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
              <div style={{ color: THEME.uiTextMuted }}>
                <span style={{ color: THEME.uiText, fontWeight: 600 }}>W/S</span> Drive
              </div>
              <div style={{ color: THEME.uiTextMuted }}>
                <span style={{ color: THEME.uiText, fontWeight: 600 }}>A/D</span> Steer
              </div>
              <div style={{ color: THEME.uiTextMuted }}>
                <span style={{ color: THEME.uiText, fontWeight: 600 }}>SPACE</span> Brake
              </div>
              <div style={{ color: THEME.uiTextMuted }}>
                <span style={{ color: THEME.uiText, fontWeight: 600 }}>V</span> View Mode
              </div>
              <div style={{ color: THEME.uiTextMuted }}>
                <span style={{ color: THEME.uiText, fontWeight: 600 }}>Z/X</span> Zoom
              </div>
              <div style={{ color: THEME.uiTextMuted }}>
                <span style={{ color: THEME.uiText, fontWeight: 600 }}>M</span> Mute
              </div>
              <div style={{ color: THEME.uiTextMuted }}>
                <span style={{ color: THEME.uiText, fontWeight: 600 }}>R</span> Restart
              </div>
              <div style={{ color: THEME.uiTextMuted }}>
                <span style={{ color: THEME.uiText, fontWeight: 600 }}>ESC</span> Pause
              </div>
              <div style={{ color: THEME.uiTextMuted }}>
                <span style={{ color: THEME.uiText, fontWeight: 600 }}>1</span> Reset Zoom
              </div>
              {accessibility.screenReaderMode && (
                <div style={{ color: '#a78bfa', gridColumn: 'span 2' }}>
                  <span style={{ fontWeight: 600 }}>?</span> Status (Screen Reader)
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={() => setGameState('playing')}
            aria-label="Resume game"
            style={{
              padding: '14px 40px',
              minHeight: 48,
              fontSize: 16,
              backgroundColor: THEME.uiAccent,
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
              marginBottom: 12,
              fontFamily: 'inherit',
              fontWeight: 700
            }}
          >
            RESUME
          </button>
          <button
            onClick={() => {
              audioEngine.stopEngine();
              setCameraZoom(1.0);
              setGameState('menu');
            }}
            style={{
              padding: '14px 40px',
              minHeight: 48,
              fontSize: 16,
              backgroundColor: 'transparent',
              border: `1px solid ${THEME.uiBorder}`,
              borderRadius: 8,
              color: THEME.uiTextMuted,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            QUIT
          </button>
        </div>
      )}

      {/* Confetti celebration - only during success */}
      {showConfetti && gameState === 'success' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 200,
          overflow: 'hidden'
        }}>
          {Array.from({ length: 80 }).map((_, i) => {
            const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
            const color = colors[i % colors.length];
            const left = Math.random() * 100;
            const delay = Math.random() * 2;
            const duration = 2.5 + Math.random() * 2;
            const size = 8 + Math.random() * 8;
            const rotation = Math.random() * 360;
            
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: -20,
                  width: size,
                  height: size * (0.5 + Math.random() * 0.5),
                  backgroundColor: color,
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  transform: `rotate(${rotation}deg)`,
                  animation: `confettiFall ${duration}s ease-out ${delay}s forwards`,
                  opacity: 0
                }}
              />
            );
          })}
        </div>
      )}

      {/* Success overlay */}
      {gameState === 'success' && (() => {
        const starsEarned = calculateStars(score);
        const playerLevel = getPlayerLevel(stats.totalXP);
        const levelProgress = getLevelProgress(stats.totalXP);
        const par = LEVEL_PARS[currentLevel];
        const timeElapsed = Math.round((Date.now() - startTime) / 1000);
        
        return (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: THEME.uiText,
          zIndex: 100,
          animation: 'fadeIn 0.4s ease',
          overflowY: 'auto',
          padding: '20px 10px'
        }}>
          <div style={{
            fontSize: 14,
            color: THEME.uiTextMuted,
            letterSpacing: 4,
            marginBottom: 8,
            animation: 'fadeInDown 0.5s ease'
          }}>DOCKED</div>
          
          {/* Animated Star display */}
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginBottom: 15,
            fontSize: 50
          }}>
            {[1, 2, 3].map(star => (
              <span 
                key={star}
                style={{ 
                  opacity: star <= starsEarned ? 1 : 0.15,
                  transform: star <= starsEarned ? 'scale(1)' : 'scale(0.7)',
                  textShadow: star <= starsEarned ? '0 0 30px #fbbf24, 0 0 60px #fbbf24' : 'none',
                  animation: star <= starsEarned ? `starPop 0.5s ease ${star * 0.2}s both` : 'none',
                  filter: star <= starsEarned ? 'drop-shadow(0 0 10px #fbbf24)' : 'none'
                }}
              >⭐</span>
            ))}
          </div>
          
          <div style={{
            fontSize: 100,
            fontWeight: 800,
            color: getGrade(score).color,
            lineHeight: 1,
            animation: 'scaleIn 0.4s ease 0.3s both'
          }}>{getGrade(score).letter}</div>
          <div style={{
            fontSize: 14,
            color: getGrade(score).color,
            marginBottom: 10
          }}>{getGrade(score).label}</div>
          <div style={{
            fontSize: 'clamp(32px, 8vh, 48px)',
            fontWeight: 700,
            marginBottom: 15,
            animation: 'fadeInUp 0.4s ease 0.4s both'
          }}>{score}</div>
          
          {/* Attempt penalty indicator */}
          {attempts > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 15,
              padding: '6px 14px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              borderRadius: 16,
              border: '1px solid rgba(245, 158, 11, 0.3)',
              animation: 'fadeIn 0.3s ease 0.6s both'
            }}>
              <span style={{ fontSize: 12, color: '#f59e0b' }}>
                Attempt {attempts} • {Math.round(getAttemptMultiplier(attempts) * 100)}% Rewards
              </span>
            </div>
          )}
          
          {/* Player Level Bar */}
          <div style={{
            width: 'min(250px, calc(100vw - 40px))',
            marginBottom: 20,
            padding: 10,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 8
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6
            }}>
              <span style={{ fontSize: 12, color: THEME.uiTextMuted }}>
                {playerLevel.icon} {playerLevel.name}
              </span>
              <span style={{ fontSize: 11, color: THEME.uiTextMuted }}>
                Lv.{playerLevel.level}
              </span>
            </div>
            <div style={{
              height: 6,
              backgroundColor: '#1a1a1e',
              borderRadius: 3,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${levelProgress * 100}%`,
                height: '100%',
                backgroundColor: '#3b82f6',
                borderRadius: 3,
                transition: 'width 0.5s'
              }} />
            </div>
          </div>
          
          {/* Stats */}
          <div style={{
            display: 'flex',
            gap: 30,
            marginBottom: 20,
            fontSize: 14,
            color: THEME.uiTextMuted
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: collisions === 0 ? THEME.uiSuccess : THEME.uiText }}>
                {collisions}
              </div>
              <div>Hits</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 700, 
                color: par && timeElapsed < par.time ? THEME.uiSuccess : THEME.uiText 
              }}>
                {timeElapsed}s
              </div>
              <div>Time {par && <span style={{ fontSize: 10 }}>(par {par.time}s)</span>}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 700, 
                color: par && pullUps <= par.pullUps ? THEME.uiSuccess : THEME.uiText 
              }}>
                {pullUps}
              </div>
              <div>Pull-ups {par && <span style={{ fontSize: 10 }}>(par {par.pullUps})</span>}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', padding: '0 16px' }}>
            {currentLevel !== 'endless' && currentLevel < 8 && score >= levelConfig.targetScore && (
              <button
                onClick={() => startGame(currentLevel + 1)}
                style={{
                  padding: '14px 30px',
                  fontSize: 14,
                  backgroundColor: THEME.uiSuccess,
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 600
                }}
              >
                NEXT LEVEL →
              </button>
            )}
            {currentLevel === 'endless' && (
              <button
                onClick={() => {
                  initLevel();
                  setGameState('countdown');
                  setCountdown(3);
                }}
                style={{
                  padding: '14px 30px',
                  fontSize: 14,
                  backgroundColor: THEME.uiSuccess,
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 600
                }}
              >
                CONTINUE →
              </button>
            )}
            <button
              onClick={() => {
                setAttempts(prev => prev + 1);
                initLevel();
                setGameState('countdown');
                setCountdown(3);
              }}
              style={{
                padding: '14px 30px',
                fontSize: 14,
                backgroundColor: THEME.uiCard,
                border: `1px solid ${THEME.uiBorder}`,
                borderRadius: 6,
                color: THEME.uiText,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              RETRY
            </button>
            <button
              onClick={() => {
                audioEngine.stopEngine();
                setCameraZoom(1.0);
                if (embedded) { onComplete?.({ passed: false, abandoned: true }); return; }
                setGameState('menu');
              }}
              style={{
                padding: '14px 30px',
                fontSize: 14,
                backgroundColor: 'transparent',
                border: `1px solid ${THEME.uiBorder}`,
                borderRadius: 6,
                color: THEME.uiTextMuted,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              MENU
            </button>
          </div>
        </div>
      );
      })()}

      {/* Failure debris effect */}
      {showFailureEffect && (
        <div style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 200,
          overflow: 'hidden'
        }}>
          {/* Central shockwave */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '40%',
            width: 100,
            height: 100,
            marginLeft: -50,
            marginTop: -50,
            borderRadius: '50%',
            border: '3px solid rgba(239, 68, 68, 0.6)',
            animation: 'failShockwave 0.8s ease-out forwards'
          }} />
          {/* Falling debris particles — pre-computed, no Math.random() on render */}
          {failureDebrisParticles.map((p, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${p.left}%`,
                  top: '30%',
                  width: p.size,
                  height: p.size * p.heightRatio,
                  backgroundColor: p.color,
                  borderRadius: p.isEmber ? '50%' : '2px',
                  transform: `rotate(${p.rotation}deg)`,
                  animation: `failDebrisFall ${p.duration}s ease-in ${p.delay}s forwards`,
                  opacity: 0,
                  boxShadow: p.isEmber ? `0 0 ${p.glowSize}px ${p.color}` : 'none'
                }}
              />
            ))}
        </div>
      )}

      {/* Failed overlay */}
      {gameState === 'failed' && (() => {
        const nextAttempt = attempts + 1;
        const nextMultiplier = getAttemptMultiplier(nextAttempt);
        const maxPullUps = getMaxPullUps(currentLevel);
        const par = LEVEL_PARS[currentLevel];
        
        let failTitle, failSubtitle, titleColor, titleGlow;
        if (failReason === 'pullups') {
          failTitle = '🔄 TOO MANY PULL-UPS';
          failSubtitle = `You made ${pullUps} pull-ups — the max for this level is ${maxPullUps}. Plan your approach and commit to your angle!`;
          titleColor = '#f59e0b';
          titleGlow = '0 0 30px rgba(245, 158, 11, 0.5)';
        } else if (failReason === 'timeout') {
          failTitle = '⏱️ TIME UP';
          failSubtitle = 'You ran out of time!';
          titleColor = THEME.uiDanger;
          titleGlow = '0 0 30px rgba(239, 68, 68, 0.5)';
        } else {
          failTitle = '💥 COLLISION';
          failSubtitle = 'Any collision means instant failure!';
          titleColor = THEME.uiDanger;
          titleGlow = '0 0 30px rgba(239, 68, 68, 0.5)';
        }
        
        return (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: THEME.uiText,
          zIndex: 100,
          animation: 'fadeIn 0.3s ease',
          overflowY: 'auto',
          padding: '20px 10px'
        }}>
          <div style={{
            fontSize: 'clamp(32px, 8vh, 48px)',
            fontWeight: 800,
            color: titleColor,
            marginBottom: 10,
            animation: 'scaleIn 0.4s ease',
            textShadow: titleGlow
          }}>{failTitle}</div>
          
          <div style={{
            fontSize: 14,
            color: THEME.uiTextMuted,
            marginBottom: 20,
            maxWidth: 'min(380px, calc(100vw - 40px))',
            textAlign: 'center',
            lineHeight: 1.5,
            animation: 'fadeInUp 0.4s ease 0.1s both'
          }}>{failSubtitle}</div>
          
          {/* Pull-ups tip for pullup failures */}
          {failReason === 'pullups' && par && (
          <div style={{
            marginBottom: 16,
            padding: '10px 16px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 8,
            textAlign: 'center',
            fontSize: 12,
            color: '#fbbf24',
            animation: 'fadeInUp 0.4s ease 0.15s both'
          }}>
            💡 Par for this level is {par.pullUps} pull-up{par.pullUps !== 1 ? 's' : ''}. Try to nail your angle early!
          </div>
          )}
          
          {/* Attempt info */}
          <div style={{
            marginBottom: 20,
            padding: '12px 20px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 8,
            textAlign: 'center',
            animation: 'fadeInUp 0.4s ease 0.2s both'
          }}>
            <div style={{ fontSize: 12, color: THEME.uiTextMuted, marginBottom: 6 }}>
              ATTEMPT {attempts}
            </div>
            {nextMultiplier < 1 && (
              <div style={{ 
                fontSize: 13, 
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}>
                <span>⚠️</span>
                <span>Next retry: {Math.round(nextMultiplier * 100)}% rewards</span>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', padding: '0 16px' }}>
            <button
              onClick={() => {
                setAttempts(prev => prev + 1);
                setCollisions(0);
                setPullUps(0);
                initLevel();
                setGameState('countdown');
                setCountdown(3);
              }}
              style={{
                padding: '14px 30px',
                fontSize: 14,
                backgroundColor: failReason === 'pullups' ? '#f59e0b' : THEME.uiAccent,
                border: 'none',
                borderRadius: 6,
                color: failReason === 'pullups' ? '#000' : '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 600
              }}
            >
              TRY AGAIN
            </button>
            <button
              onClick={() => {
                audioEngine.stopEngine();
                setCameraZoom(1.0);
                if (embedded) { onComplete?.({ passed: false, abandoned: true }); return; }
                setGameState('menu');
              }}
              style={{
                padding: '14px 30px',
                fontSize: 14,
                backgroundColor: 'transparent',
                border: `1px solid ${THEME.uiBorder}`,
                borderRadius: 6,
                color: THEME.uiTextMuted,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              MENU
            </button>
          </div>
        </div>
      );
      })()}

      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          backgroundColor: notification.type === 'success' ? 'rgba(34, 197, 94, 0.95)' :
                          notification.type === 'error' ? 'rgba(239, 68, 68, 0.95)' :
                          notification.type === 'warning' ? 'rgba(245, 158, 11, 0.95)' :
                          'rgba(59, 130, 246, 0.95)',
          color: '#fff',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          zIndex: 300,
          animation: 'fadeInUp 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          {notification.type === 'success' && '✓'}
          {notification.type === 'error' && '✕'}
          {notification.type === 'warning' && '⚠'}
          {notification.type === 'info' && 'ℹ'}
          {notification.message}
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: THEME.uiBg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 400,
          animation: 'fadeIn 0.2s ease'
        }}>
          {/* Animated truck icon */}
          <div style={{
            fontSize: 'clamp(32px, 8vh, 48px)',
            marginBottom: 20,
            animation: 'bounce 1s ease-in-out infinite'
          }}>
            🚚
          </div>
          
          {/* Progress bar */}
          <div style={{
            width: 200,
            height: 6,
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 16
          }}>
            <div style={{
              width: '60%',
              height: '100%',
              backgroundColor: THEME.uiAccent,
              borderRadius: 3,
              animation: 'shimmer 1.5s ease-in-out infinite'
            }} />
          </div>
          
          <div style={{
            color: THEME.uiTextMuted,
            fontSize: 14,
            letterSpacing: 1
          }}>LOADING DOCK...</div>
        </div>
      )}
    </div>
  );
}); // React.memo — prevents App.jsx re-renders from cascading into DockMaster


// === WRAPPED EXPORT WITH ERROR BOUNDARY ===
const DockBackingGame = React.memo(function DockBackingGame(props) {
  return (
    <div style={{
      backgroundColor: '#0a0a0c',
      width: '100%',
      height: '100%',
      minHeight: '100vh',
      overflow: 'hidden',
    }}>
      <GameErrorBoundary>
        <DockBackingGameInner {...props} />
      </GameErrorBoundary>
    </div>
  );
});

export default DockBackingGame;
