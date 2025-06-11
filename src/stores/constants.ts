import * as THREE from "three";

interface FieldDimensions {
  LENGTH: number;
  WIDTH: number;
  GOAL_WIDTH: number;
  GOAL_HEIGHT: number;
  GOAL_DEPTH: number;
  PENALTY_AREA_DEPTH: number;
  PENALTY_AREA_WIDTH: number;
  GOAL_AREA_DEPTH: number;
  GOAL_AREA_WIDTH: number;
  PENALTY_SPOT_DISTANCE: number;
  CENTER_CIRCLE_RADIUS: number;
  POST_RADIUS: number;
}

interface PhysicsConstants {
  GRAVITY: THREE.Vector3;
  RHO: number;
  AIR_RESISTANCE_FACTOR: number;
  GROUND_FRICTION_FACTOR: number;
  RESTITUTION_COEFFICIENT: number;
  POST_RESTITUTION_COEFFICIENT: number;
  MAGNUS_COEFFICIENT: number;
}

interface ObjectSizes {
  BALL_RADIUS: number;
  BALL_MASS: number;
  PLAYER_HEIGHT: number;
  GOALKEEPER_HEIGHT: number;
}

interface ControlConstants {
  MAX_POWER: number;
  POWER_CHARGE_SPEED: number;
  MAX_ACCUMULATED_CURVE_MAGNITUDE: number;
  CAMERA_SENSITIVITY: number;
  MAX_PITCH: number;
  MIN_PITCH: number;
  GK_AGILITY: number; // 门将敏捷度
}

// 球场尺寸常量
export const FIELD: FieldDimensions = {
  LENGTH: 105, // 球场长度 (米)
  WIDTH: 70, // 球场宽度 (米)
  GOAL_WIDTH: 7.32, // 球门宽度
  GOAL_HEIGHT: 2.44, // 球门高度
  GOAL_DEPTH: 2.0, // 球网深度
  PENALTY_AREA_DEPTH: 16.5, // 禁区深度
  PENALTY_AREA_WIDTH: 7.32 + 2 * 16.5, // 禁区宽度
  GOAL_AREA_DEPTH: 5.5, // 小禁区深度
  GOAL_AREA_WIDTH: 7.32 + 2 * 5.5, // 小禁区宽度
  PENALTY_SPOT_DISTANCE: 11, // 罚球点距离
  CENTER_CIRCLE_RADIUS: 9.15, // 中圈半径
  POST_RADIUS: 0.06, // 门柱半径
};

// 物理常量
export const PHYSICS: PhysicsConstants = {
  GRAVITY: new THREE.Vector3(0, -9.81, 0), // 重力加速度 (m/s²)
  RHO: 1.225, // 空气密度 (kg/m³)
  AIR_RESISTANCE_FACTOR: 0.35, // 足球的阻力系数
  GROUND_FRICTION_FACTOR: 0.7, // 地面摩擦系数
  RESTITUTION_COEFFICIENT: 0.4, // 球体碰撞恢复系数
  POST_RESTITUTION_COEFFICIENT: 0.5, // 门柱碰撞恢复系数
  MAGNUS_COEFFICIENT: 0.01, // 马格努斯效应系数
};

// 游戏对象尺寸
export const SIZES: ObjectSizes = {
  BALL_RADIUS: 0.11, // 足球半径
  BALL_MASS: 0.43, // 足球质量 (kg)
  PLAYER_HEIGHT: 1.8, // 球员高度
  GOALKEEPER_HEIGHT: 1.95, // 门将高度
};

// 游戏控制常量
export const CONTROLS: ControlConstants = {
  MAX_POWER: 125,
  POWER_CHARGE_SPEED: 0.8,
  MAX_ACCUMULATED_CURVE_MAGNITUDE: 100, // 最大曲线累积幅度
  CAMERA_SENSITIVITY: 0.0025,
  MAX_PITCH: (Math.PI / 2) * 0.48,
  MIN_PITCH: (-Math.PI / 2) * 0.1,
  GK_AGILITY: 0.05, // 门将敏捷度
};
