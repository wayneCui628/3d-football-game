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
  AIR_RESISTANCE_FACTOR: number;
  GROUND_FRICTION_FACTOR: number;
  RESTITUTION_COEFFICIENT: number;
  POST_RESTITUTION_COEFFICIENT: number;
}

interface ObjectSizes {
  BALL_RADIUS: number;
  PLAYER_HEIGHT: number;
}

interface ControlConstants {
  MAX_POWER: number;
  POWER_CHARGE_SPEED: number;
  MAX_CURVE: number;
  CURVE_SENSITIVITY: number;
  CAMERA_SENSITIVITY: number;
  MAX_PITCH: number;
  MIN_PITCH: number;
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
  AIR_RESISTANCE_FACTOR: 0.05, // 空气阻力系数
  GROUND_FRICTION_FACTOR: 0.7, // 地面摩擦系数
  RESTITUTION_COEFFICIENT: 0.4, // 球体碰撞恢复系数
  POST_RESTITUTION_COEFFICIENT: 0.5, // 门柱碰撞恢复系数
};

// 游戏对象尺寸
export const SIZES: ObjectSizes = {
  BALL_RADIUS: 0.11, // 足球半径
  PLAYER_HEIGHT: 1.8, // 球员高度
};

// 游戏控制常量
export const CONTROLS: ControlConstants = {
  MAX_POWER: 125,
  POWER_CHARGE_SPEED: 0.3,
  MAX_CURVE: 2.0,
  CURVE_SENSITIVITY: 0.008,
  CAMERA_SENSITIVITY: 0.0025,
  MAX_PITCH: (Math.PI / 2) * 0.48,
  MIN_PITCH: (-Math.PI / 2) * 0.1,
};
