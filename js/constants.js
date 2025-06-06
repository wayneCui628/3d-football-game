import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

// 球场尺寸常量
export const FIELD = {
    LENGTH: 105,    // 球场长度 (米)
    WIDTH: 68,      // 球场宽度 (米)
    GOAL_WIDTH: 7.32,    // 球门宽度
    GOAL_HEIGHT: 2.44,   // 球门高度
    GOAL_DEPTH: 2.0,     // 球网深度
    PENALTY_AREA_DEPTH: 16.5, // 禁区深度
    PENALTY_AREA_WIDTH: 7.32 + 2 * 16.5, // 禁区宽度
    GOAL_AREA_DEPTH: 5.5,    // 小禁区深度
    GOAL_AREA_WIDTH: 7.32 + 2 * 5.5, // 小禁区宽度
    PENALTY_SPOT_DISTANCE: 11, // 罚球点距离
    CENTER_CIRCLE_RADIUS: 9.15, // 中圈半径
};

// 物理常量
const PHYSICS = {
    GRAVITY: new THREE.Vector3(0, -9.81, 0),
    AIR_RESISTANCE_FACTOR: 0.05,
    GROUND_FRICTION_FACTOR: 0.7,
    RESTITUTION_COEFFICIENT: 0.6,
    POST_RESTITUTION_COEFFICIENT: 0.5
};

// 游戏对象尺寸
const SIZES = {
    BALL_RADIUS: 0.11,   // 足球半径
    PLAYER_HEIGHT: 1.8,  // 球员高度
};

// 游戏控制常量
const CONTROLS = {
    MAX_POWER: 100,
    POWER_CHARGE_SPEED: 0.5,
    MAX_CURVE: 2.0,
    CURVE_SENSITIVITY: 0.008,
    CAMERA_SENSITIVITY: 0.0025,
    MAX_PITCH: Math.PI / 2 * 0.48,
    MIN_PITCH: -Math.PI / 2 * 0.1
};

// 初始位置
const INITIAL_POSITIONS = {
    CENTER: { x: 0, z: 28 },
    LEFT: { x: -FIELD.WIDTH * 0.2, z: 22 },
    RIGHT: { x: FIELD.WIDTH * 0.2, z: 22 }
}; 