<template>
  <div class="game-wrapper">
    <div ref="container" id="game-container" class="game-container"></div>
    <!-- 游戏UI -->
    <div class="game-ui">
      <!-- 准星 -->
      <div id="crosshair" class="crosshair"></div>

      <!-- 力量条 -->
      <div class="power-meter">
        <div class="power-fill"></div>
      </div>

      <!-- 弧线指示器 -->
      <div class="curve-indicator">
        <span>弧线: </span>
        <span class="curve-value">0.0</span>
      </div>

      <!-- 游戏状态 -->
      <div class="game-stats">
        <div class="stat">
          <span>射门: </span>
          <span id="shots-count">0</span>
        </div>
        <div class="stat">
          <span>进球: </span>
          <span id="goals-count">0</span>
        </div>
        <div class="stat">
          <span>成功率: </span>
          <span id="success-rate">0%</span>
        </div>
      </div>

      <!-- 射门结果提示 -->
      <div id="shot-result" class="shot-result"></div>

      <!-- 错误信息 -->
      <div id="error-message" class="error-message"></div>
    </div>
    <PauseScreen v-if="isPaused" @gemeResume="gemeResume" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import * as THREE from "three";
import { CONTROLS, FIELD, PHYSICS, SIZES } from "@/stores/constants";
import { Ball } from "@/models/ball";
import { Player } from "@/models/player";
import { Wall } from "@/models/wall";
import { Goalkeeper } from "@/models/goalkeeper";
import { Field } from "@/models/field";
import PauseScreen from "@/components/PauseScreen.vue";

const { gameStarted } = defineProps({
  gameStarted: {
    type: Boolean,
    default: false,
  },
});

const container = ref<HTMLElement | null>(null);
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let ball: Ball;
let player: Player;
let wall: Wall;
let goalkeeper: Goalkeeper;

const power = ref(0);
const isCharging = ref(false);
const shootDirection = new THREE.Vector3();
const cameraRotation = ref({ x: Math.PI / 10, y: Math.PI });
const isPaused = ref(false);
let isPointerLocked = false;

const shotsCount = ref(0);
const goalsCount = ref(0);

let animationFrameId: number | null = null;
let lastShotTime = 0;
let powerChargeDirection = 1;
let curveAmount = 0;

let cameraAzimuth = 0; // 摄像机水平方位角 (绕Y轴)
let cameraElevation = Math.PI / 6; // 摄像机俯仰角 (初始向上看一点，例如30度)
const cameraDistance = 5; // 摄像机与玩家的固定距离
const cameraTargetOffset = new THREE.Vector3(0, 1.5, 0); // 摄像机看向玩家身上的偏移量 (例如，看向玩家胸部而不是脚底)
const mouseSensitivity = 0.0025;
const minElevation = -Math.PI / 12; // 最小俯仰角 (例如-60度)
const maxElevation = (Math.PI / 3) * 0.9; // 最大俯仰角 (例如接近90度，但不完全是，防止万向节锁问题)

const createScene = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
};

const createCamera = () => {
  const container = document.getElementById("game-container");
  camera = new THREE.PerspectiveCamera(
    50,
    container.offsetWidth / container.offsetHeight,
    0.1,
    2000
  );
};

const createRenderer = () => {
  const container = document.getElementById("game-container");
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(container.offsetWidth, container.offsetHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
};

const createLights = () => {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(
    FIELD.WIDTH * 0.4,
    FIELD.LENGTH * 0.5,
    -FIELD.LENGTH / 2 + FIELD.LENGTH * 0.3
  );
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 4096;
  directionalLight.shadow.mapSize.height = 4096;
  directionalLight.shadow.camera.near = 10;
  directionalLight.shadow.camera.far = FIELD.LENGTH * 1.5;
  directionalLight.shadow.camera.left = -FIELD.WIDTH * 0.75;
  directionalLight.shadow.camera.right = FIELD.WIDTH * 0.75;
  directionalLight.shadow.camera.top = FIELD.LENGTH * 0.75;
  directionalLight.shadow.camera.bottom = -FIELD.LENGTH * 0.75;
  scene.add(directionalLight);
};

const createField = () => {
  const field = new Field(scene);
  field.createField();
};

const createBall = () => {
  const initialPosition = new THREE.Vector3(
    0,
    SIZES.BALL_RADIUS,
    -FIELD.LENGTH / 2 + 25
  );
  ball = new Ball(scene, initialPosition, renderer);
};

const createPlayer = () => {
  const initialPosition = ball.getPosition();
  initialPosition.z += 1;
  player = new Player(scene, initialPosition);
  camera.position.set(
    initialPosition.x,
    SIZES.PLAYER_HEIGHT * 1.5,
    initialPosition.z + 5
  );
};

const createWall = () => {
  wall = new Wall(scene, ball.getPosition(), -FIELD.LENGTH / 2);
};

const createGoalkeeper = () => {
  goalkeeper = new Goalkeeper(scene, -FIELD.LENGTH / 2);
};

const setupEventListeners = () => {
  console.log("gameStarted:", gameStarted);
  // 请求鼠标锁定
  if (gameStarted) {
    renderer.domElement.requestPointerLock();
    const crosshair = document.getElementById("crosshair") as HTMLElement;
    if (crosshair) {
      crosshair.style.display = "block";
    }
  }

  renderer.domElement.addEventListener("mousedown", (e) => {
    if (!gameStarted || !isPointerLocked || ball.isMoving()) return;
    if (e.button === 0) startCharging();
  });

  document.addEventListener("mouseup", (e) => {
    if (!gameStarted || !isPointerLocked || !isCharging.value) return;
    if (e.button === 0) shoot();
  });

  document.addEventListener("mousemove", onPointerMove.bind(this));
  document.addEventListener(
    "pointerlockchange",
    onPointerLockChange.bind(this)
  );

  window.addEventListener("resize", onWindowResize.bind(this));
};

const onPointerMove = (event: MouseEvent) => {
  if (!gameStarted || !isPointerLocked) return;
  if (isCharging.value) {
    addCurve(event.movementX);
  } else {
    // 更新方位角和俯仰角
    cameraAzimuth -= event.movementX * mouseSensitivity;
    cameraElevation += event.movementY * mouseSensitivity;

    // 限制俯仰角
    cameraElevation = Math.max(
      minElevation,
      Math.min(maxElevation, cameraElevation)
    );
  }
};

const onPointerLockChange = () => {
  isPointerLocked = document.pointerLockElement === renderer.domElement;
  const crosshair = document.getElementById("crosshair") as HTMLElement;
  if (crosshair) {
    crosshair.style.display = isPointerLocked ? "block" : "none";
  }

  if (!isPointerLocked) {
    console.log("Ttoggling pause state");
    isPaused.value = true;
  }

  if (!isPointerLocked && isCharging.value) {
    isCharging.value = false;
    power.value = 0;
    updatePowerMeter();
    const curveIndicator = document.querySelector(
      ".curve-indicator"
    ) as HTMLElement;
    if (curveIndicator) {
      curveIndicator.style.display = "none";
    }
  }
};

const startCharging = () => {
  if (
    ball.isStopped() &&
    player.getGroup().position.distanceTo(ball.getPosition()) <
      SIZES.PLAYER_HEIGHT * 1.5
  ) {
    isCharging.value = true;
    power.value = 0;
    powerChargeDirection = 1;
    curveAmount = 0;
    updatePowerMeter();
    const curveValue = document.querySelector(".curve-value") as HTMLElement;
    if (curveValue) {
      curveValue.textContent = curveAmount.toFixed(1);
    }
    const curveIndicator = document.querySelector(
      ".curve-indicator"
    ) as HTMLElement;
    if (curveIndicator) {
      curveIndicator.style.display = "block";
    }
  }
};

const addCurve = (movementX: number) => {
  curveAmount -= movementX * 0.008;
  curveAmount = Math.max(-2.0, Math.min(2.0, curveAmount));
  const curveValue = document.querySelector(".curve-value") as HTMLElement;
  if (curveValue) {
    curveValue.textContent = curveAmount.toFixed(1);
  }
};

const shoot = () => {
  if (!isCharging.value) return;

  console.log("Shooting with power:", power.value);

  isCharging.value = false;
  shotsCount.value++;
  const shotsCountEl = document.getElementById("shots-count");
  if (shotsCountEl) {
    shotsCountEl.textContent = shotsCount.value.toString();
  }
  updateSuccessRate();
  const curveIndicator = document.querySelector(
    ".curve-indicator"
  ) as HTMLElement;
  if (curveIndicator) {
    curveIndicator.style.display = "none";
  }

  camera.getWorldDirection(shootDirection);
  ball.move(shootDirection, power.value, curveAmount);

  animateShot();
};

const animateShot = () => {
  let prevTime = performance.now();

  const shotLoop = (currentTime) => {
    animationFrameId = requestAnimationFrame(shotLoop);
    const deltaTime = Math.min(0.033, (currentTime - prevTime) / 1000);
    prevTime = currentTime;

    if (
      ball.getVelocity().lengthSq() < 0.001 &&
      ball.getPosition().y <= SIZES.BALL_RADIUS + 0.01
    ) {
      ball.stop();
      if (!checkGoal()) showResult("未进球");
      setTimeout(() => resetBallAndPlayer(), 1500);
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      return;
    }

    // 物理更新
    ball.update(deltaTime);

    // 碰撞检测
    checkCollisions();

    // 检查进球
    if (checkGoal()) {
      showResult("进球！GOAL!");
      goalsCount.value++;
      document.getElementById("goals-count").textContent =
        goalsCount.value.toString();
      updateSuccessRate();
      setTimeout(() => resetBallAndPlayer(), 1500);
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      return;
    }

    // 检查出界
    if (checkOutOfBounds(currentTime)) {
      if (!checkGoal()) showResult("未进球");
      setTimeout(() => resetBallAndPlayer(), 1500);
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      return;
    }
  };

  lastShotTime = performance.now();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  shotLoop(lastShotTime);
};

const checkCollisions = () => {
  // 人墙碰撞
  const wallCollision = wall.checkCollision(
    ball.getPosition(),
    SIZES.BALL_RADIUS
  );
  if (wallCollision.collided) {
    const reflectDir = ball
      .getPosition()
      .clone()
      .sub(wallCollision.playerPosition)
      .normalize();
    const speedBeforeHit = ball.getVelocity().length();
    ball.move(reflectDir, speedBeforeHit * PHYSICS.RESTITUTION_COEFFICIENT);
    console.log(
      "人墙碰撞:",
      wallCollision.playerPosition,
      speedBeforeHit,
      speedBeforeHit * PHYSICS.RESTITUTION_COEFFICIENT
    );
    showResult("击中人墙!");
    return;
  }

  // 守门员扑救
  const saveResult = goalkeeper.checkSave(ball.getPosition());
  if (saveResult.saved) {
    showResult("守门员扑出!");
    const reflectDir = ball
      .getPosition()
      .clone()
      .sub(saveResult.goalkeeperPosition)
      .normalize();
    const speedBeforeHit = ball.getVelocity().length();
    ball.move(reflectDir, speedBeforeHit * PHYSICS.RESTITUTION_COEFFICIENT);
    return;
  }

  // 门框碰撞
  checkGoalpostCollision();
};

// 假设 Ball 类有一个直接设置速度的方法，或者 getVelocity() 返回的是引用（不推荐）
// 更好的方式是在 Ball 类内部提供一个方法来应用碰撞效果
// 例如：ball.applyCollisionResponse(normal, restitutionCoefficient);

const checkGoalpostCollision = () => {
  const ballMesh = ball.getMesh(); // 直接操作球的 Mesh 对象以获取和设置位置
  const currentBallVelocity = ball.getVelocity(); // 获取球的当前速度向量 (假设是克隆)
  let newVelocity = currentBallVelocity.clone(); // 用于计算新的速度
  let collisionOccurred = false;

  const postCheckBuffer = SIZES.BALL_RADIUS * 1.5; // 可以适当调整
  const goalLineZ = -FIELD.LENGTH / 2; // 球门线的Z坐标

  // 优化：只在球大致在球门区域内才进行详细检测
  if (
    Math.abs(ballMesh.position.x) >
      FIELD.GOAL_WIDTH / 2 + SIZES.BALL_RADIUS + postCheckBuffer ||
    Math.abs(ballMesh.position.z - goalLineZ) >
      FIELD.GOAL_DEPTH + SIZES.BALL_RADIUS + postCheckBuffer || // FIELD.GOAL_DEPTH 应该是门柱的厚度或一个小的Z范围
    ballMesh.position.y >
      FIELD.GOAL_HEIGHT + SIZES.BALL_RADIUS + postCheckBuffer ||
    ballMesh.position.y < -SIZES.BALL_RADIUS - postCheckBuffer // 考虑球可能从地面以下过来（虽然不太可能）
  ) {
    return; // 球离球门太远
  }

  const postRadius = 0.06; // 门柱半径
  const combinedRadius = SIZES.BALL_RADIUS + postRadius;

  // --- 立柱检测 ---
  const posts = [
    { x: -FIELD.GOAL_WIDTH / 2, name: "左门柱" },
    { x: FIELD.GOAL_WIDTH / 2, name: "右门柱" },
  ];

  for (const post of posts) {
    // 检查Y方向是否在门柱高度范围内
    if (
      ballMesh.position.y < FIELD.GOAL_HEIGHT + postRadius &&
      ballMesh.position.y > -postRadius
    ) {
      // 计算球心到门柱中心在XZ平面的距离
      const distSqXZ =
        (ballMesh.position.x - post.x) ** 2 +
        (ballMesh.position.z - goalLineZ) ** 2;

      if (distSqXZ < combinedRadius ** 2) {
        collisionOccurred = true;
        showResult(`中${post.name}!`);

        // 1. 计算碰撞点法线 (近似)
        //    从门柱中心指向球心的向量 (只考虑XZ平面)
        const normal = new THREE.Vector3(
          ballMesh.position.x - post.x,
          0,
          ballMesh.position.z - goalLineZ
        ).normalize();

        // 2. 计算反射速度 (v' = v - 2 * dot(v, n) * n)
        const dot = currentBallVelocity.dot(normal);
        const reflection = normal.clone().multiplyScalar(2 * dot);
        newVelocity
          .sub(reflection)
          .multiplyScalar(PHYSICS.POST_RESTITUTION_COEFFICIENT);

        // 3. 将球移出碰撞体
        //    沿着法线方向将球推到刚好不碰撞的位置
        const penetrationDepth = combinedRadius - Math.sqrt(distSqXZ);
        ballMesh.position.add(
          normal.clone().multiplyScalar(penetrationDepth + 0.001)
        ); // 加一点点buffer

        console.log(
          `${post.name}碰撞:`,
          ballMesh.position,
          newVelocity.length()
        );
        break; // 一次只处理一次碰撞
      }
    }
  }

  if (collisionOccurred) {
    ball.move(newVelocity, newVelocity.length()); // 假设 Ball 类有 setVelocity 方法
    return; // 如果撞到立柱，不再检测横梁（简化处理）
  }

  // --- 横梁检测 ---
  // 横梁的Z坐标也应该是 goalLineZ
  // 横梁可以看作一个沿X轴的圆柱体或长方体
  // 简化检测：先看X, Z是否在范围内，再看Y是否碰撞
  if (
    Math.abs(ballMesh.position.x) < FIELD.GOAL_WIDTH / 2 - postRadius && // 在两个立柱之间
    Math.abs(ballMesh.position.z - goalLineZ) < SIZES.BALL_RADIUS + postRadius // Z方向上接近横梁
  ) {
    if (
      Math.abs(ballMesh.position.y - FIELD.GOAL_HEIGHT) <
      SIZES.BALL_RADIUS + postRadius
    ) {
      collisionOccurred = true;
      showResult("中楣!");

      // 1. 计算碰撞点法线 (近似)
      //    如果球从下方撞击横梁，法线向上 (0, 1, 0)
      //    如果球从上方撞击横梁（不太可能，除非大力射门后下坠），法线向下 (0, -1, 0)
      const normal = new THREE.Vector3(
        0,
        ballMesh.position.y > FIELD.GOAL_HEIGHT ? -1 : 1,
        0
      );

      // 2. 计算反射速度
      const dot = currentBallVelocity.dot(normal);
      const reflection = normal.clone().multiplyScalar(2 * dot);
      newVelocity
        .sub(reflection)
        .multiplyScalar(PHYSICS.POST_RESTITUTION_COEFFICIENT);
      // 特别地，对于横梁，主要反弹Y，可以简化为：
      // newVelocity.y *= -PHYSICS.POST_RESTITUTION_COEFFICIENT;
      // newVelocity.x *= PHYSICS.POST_FRICTION; // 横梁也可能有摩擦
      // newVelocity.z *= PHYSICS.POST_FRICTION;

      // 3. 将球移出碰撞体
      const penetrationDepth =
        SIZES.BALL_RADIUS +
        postRadius -
        Math.abs(ballMesh.position.y - FIELD.GOAL_HEIGHT);
      ballMesh.position.add(
        normal.clone().multiplyScalar(penetrationDepth + 0.001)
      );

      console.log("横梁碰撞:", ballMesh.position, newVelocity.length());
    }
  }

  if (collisionOccurred) {
    ball.move(newVelocity, newVelocity.length()); // 假设 Ball 类有 setVelocity 方法
  }
};

// const checkGoalpostCollision = () => {
//   const postCheckBuffer = SIZES.BALL_RADIUS * 2;
//   const nearGoalLineZ =
//     ball.getPosition().z < -FIELD.LENGTH / 2 + postCheckBuffer &&
//     ball.getPosition().z >
//       -FIELD.LENGTH / 2 - FIELD.GOAL_DEPTH - postCheckBuffer;

//   if (nearGoalLineZ) {
//     const postRadius = 0.06;

//     // 左门柱
//     if (
//       Math.hypot(
//         ball.getPosition().x - -FIELD.GOAL_WIDTH / 2,
//         ball.getPosition().z - -FIELD.LENGTH / 2
//       ) <
//         SIZES.BALL_RADIUS + postRadius &&
//       ball.getPosition().y < FIELD.GOAL_HEIGHT + postRadius &&
//       ball.getPosition().y > -postRadius
//     ) {
//       const ballVelocity = ball.getVelocity();
//       ballVelocity.z *= -PHYSICS.POST_RESTITUTION_COEFFICIENT;
//       // ballVelocity.x *= Math.random() * 0.5 - 0.25;
//       // ballVelocity.y *= Math.random() * 0.5 + 0.5; // 增加Y轴速度的随机性
//       ball.move(ballVelocity.normalize(), ballVelocity.length());
//       showResult("中柱!");
//     }

//     // 右门柱
//     if (
//       Math.hypot(
//         ball.getPosition().x - FIELD.GOAL_WIDTH / 2,
//         ball.getPosition().z - -FIELD.LENGTH / 2
//       ) <
//         SIZES.BALL_RADIUS + postRadius &&
//       ball.getPosition().y < FIELD.GOAL_HEIGHT + postRadius &&
//       ball.getPosition().y > -postRadius
//     ) {
//       const ballVelocity = ball.getVelocity();
//       ballVelocity.z *= -PHYSICS.POST_RESTITUTION_COEFFICIENT;
//       // ballVelocity.x *= Math.random() * 0.5 - 0.25;
//       // ballVelocity.y *= Math.random() * 0.5 + 0.5; // 增加Y轴速度的随机性
//       console.log(
//         "右门柱碰撞:",
//         ball.getPosition(),
//         ballVelocity.length(),
//         PHYSICS.POST_RESTITUTION_COEFFICIENT
//       );
//       ball.move(ballVelocity.normalize(), ballVelocity.length());
//       showResult("中柱!");
//     }

//     // 横梁
//     if (
//       Math.abs(ball.getPosition().y - FIELD.GOAL_HEIGHT) <
//         SIZES.BALL_RADIUS + postRadius &&
//       Math.abs(ball.getPosition().x) < FIELD.GOAL_WIDTH / 2 &&
//       Math.abs(ball.getPosition().z - -FIELD.LENGTH / 2) < postRadius * 2
//     ) {
//       const ballVelocity = ball.getVelocity();
//       ballVelocity.z *= -PHYSICS.POST_RESTITUTION_COEFFICIENT;
//       // ballVelocity.x *= Math.random() * 0.5 - 0.25;
//       // ballVelocity.y *= Math.random() * 0.5 + 0.5; // 增加Y轴速度的随机性
//       ball.move(ballVelocity.normalize(), ballVelocity.length());
//       showResult("中楣!");
//     }
//   }
// };

const checkGoal = () => {
  const goalLine = -FIELD.LENGTH / 2;
  const inGoalPlane =
    ball.getPosition().z < goalLine + SIZES.BALL_RADIUS &&
    ball.getPosition().z > goalLine - FIELD.GOAL_DEPTH - SIZES.BALL_RADIUS;

  return (
    inGoalPlane &&
    Math.abs(ball.getPosition().x) < FIELD.GOAL_WIDTH / 2 - SIZES.BALL_RADIUS &&
    ball.getPosition().y < FIELD.GOAL_HEIGHT - SIZES.BALL_RADIUS &&
    ball.getPosition().y > SIZES.BALL_RADIUS
  );
};

const checkOutOfBounds = (currentTime) => {
  if (currentTime - lastShotTime <= 500) return false;

  const goalLineToCheck = -FIELD.LENGTH / 2;
  const behindGoal =
    ball.getPosition().z <
    goalLineToCheck - FIELD.GOAL_DEPTH - SIZES.BALL_RADIUS;
  const sideOut =
    Math.abs(ball.getPosition().x) > FIELD.WIDTH / 2 + SIZES.BALL_RADIUS;
  const tooHighAndPast =
    ball.getPosition().y > FIELD.GOAL_HEIGHT + 5 &&
    Math.abs(ball.getPosition().z) > Math.abs(goalLineToCheck);

  return behindGoal || sideOut || tooHighAndPast;
};

const resetBallAndPlayer = (initialPosition: THREE.Vector3 | null = null) => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (initialPosition) {
    ball.stop();
    ball.getPosition().copy(initialPosition);
  } else {
    ball.reset();
  }

  if (player) {
    player.reset();
  }

  cameraRotation.value.y = Math.PI;
  cameraRotation.value.x = Math.PI / 10;

  power.value = 0;
  curveAmount = 0;
  isCharging.value = false;
  updatePowerMeter();
  const curveValue = document.querySelector(".curve-value") as HTMLElement;
  if (curveValue) {
    curveValue.textContent = "0.0";
  }
  const curveIndicator = document.querySelector(
    ".curve-indicator"
  ) as HTMLElement;
  if (curveIndicator) {
    curveIndicator.style.display = "none";
  }

  updateCamera();
  createWall();
};

const updateCamera = () => {
  if (!player || !camera) return;

  // 获取玩家的当前世界位置
  const playerPosition = player.getGroup().position.clone(); // 或者 player.position 如果 player 就是 Object3D
  const offsetX =
    cameraDistance * Math.cos(cameraElevation) * Math.sin(cameraAzimuth);
  const offsetY = cameraDistance * Math.sin(cameraElevation);
  const offsetZ =
    cameraDistance * Math.cos(cameraElevation) * Math.cos(cameraAzimuth);

  // 摄像机的理想位置 = 玩家位置 + 计算出的偏移量
  const cameraIdealPosition = new THREE.Vector3(
    playerPosition.x + offsetX,
    playerPosition.y + offsetY + cameraTargetOffset.y, // 考虑目标偏移的Y分量，让摄像机高度基于玩家目标点
    playerPosition.z + offsetZ
  );

  // (可选) 平滑过渡摄像机位置，防止抖动
  camera.position.lerp(cameraIdealPosition, 0.1); // 0.1 是插值因子，值越小越平滑但延迟越高
  camera.position.copy(cameraIdealPosition); // 直接设置位置

  const lookAtPosition = ball.getPosition().clone().add(cameraTargetOffset);
  camera.lookAt(lookAtPosition);
};

const updatePowerMeter = () => {
  const powerFill = document.querySelector(".power-fill") as HTMLElement;
  if (powerFill) {
    powerFill.style.width = `${(power.value / CONTROLS.MAX_POWER) * 100}%`;
  }
};

const updateSuccessRate = () => {
  const successRate = document.getElementById("success-rate");
  if (successRate) {
    const rate =
      shotsCount.value > 0
        ? Math.round((goalsCount.value / shotsCount.value) * 100)
        : 0;
    successRate.textContent = `${rate}%`;
  }
};

const showResult = (text: string) => {
  const resultEl = document.getElementById("shot-result") as HTMLElement;
  if (resultEl) {
    resultEl.textContent = text;
    resultEl.style.display = "block";
    setTimeout(() => {
      resultEl.style.display = "none";
    }, 2000);
  }
};

const gemeResume = () => {
  isPaused.value = false;
  renderer.domElement.requestPointerLock();
};

const onWindowResize = () => {
  const container = document.getElementById("game-container");
  if (container.offsetWidth === 0 || container.offsetHeight === 0) return;

  camera.aspect = container.offsetWidth / container.offsetHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.offsetWidth, container.offsetHeight);
};

const animate = () => {
  requestAnimationFrame(animate.bind(this));

  if (isCharging.value) {
    power.value += 0.5 * powerChargeDirection;
    if (power.value >= CONTROLS.MAX_POWER) {
      power.value = CONTROLS.MAX_POWER;
      powerChargeDirection = -1;
    } else if (power.value <= 0) {
      power.value = 0;
      powerChargeDirection = 1;
    }
    updatePowerMeter();
  }

  if (goalkeeper) {
    goalkeeper.update(ball.getPosition(), ball.getVelocity());
  }

  if (camera && player) {
    // 更新摄像机位置和朝向
    updateCamera();
  }

  renderer.render(scene, camera);
};

const dispose = () => {
  window.removeEventListener("resize", onWindowResize);
  document.removeEventListener("mousemove", onPointerMove.bind(this));
  document.removeEventListener(
    "pointerlockchange",
    onPointerLockChange.bind(this)
  );

  if (renderer) {
    renderer.dispose();
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
};

const init = () => {
  try {
    console.log("开始初始化");
    createScene();
    createCamera();
    createRenderer();
    createLights();
    createField();
    createBall();
    createPlayer();
    createWall();
    createGoalkeeper();
    setupEventListeners();
    const loading = document.querySelector(".loading") as HTMLElement;
    if (loading) {
      loading.style.display = "none";
    }
    animate();
  } catch (e) {
    console.error("初始化错误:", e);
    const errorMessage = document.getElementById(
      "error-message"
    ) as HTMLElement;
    if (errorMessage) {
      errorMessage.textContent = `初始化错误: ${e.message}`;
      errorMessage.style.display = "block";
    }
  }
};

onMounted(() => {
  init();
});

onUnmounted(() => {
  dispose();
  if (container.value && renderer) {
    container.value.removeChild(renderer.domElement);
  }
});
</script>

<style lang="less" scoped>
.game-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.game-container {
  width: 100%;
  height: 100%;
}

.game-ui {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid @white;
  display: none;
}

.power-meter {
  position: absolute;
  bottom: 50px;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  height: 15px;
  background-color: @black;
  border-radius: 10px;
  overflow: hidden;

  .power-fill {
    height: 100%;
    width: 0%;
    background: @power-gradient;
    transition: width 0.1s;
  }
}

.curve-indicator {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background-color: @black;
  color: @white;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 14px;
  display: none;
}

.game-stats {
  position: absolute;
  top: 20px;
  right: 20px;
  background-color: @black;
  color: @white;
  padding: 10px;
  border-radius: 5px;
  font-size: 14px;

  .stat {
    margin-bottom: 5px;
  }
}

.shot-result {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: @black-hover;
  color: @white;
  padding: 10px 20px;
  border-radius: 5px;
  font-size: 20px;
  display: none;
}

.position-buttons {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  pointer-events: auto;
}

.position-btn {
  background-color: @black;
  color: @white;
  border: none;
  padding: 8px 15px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background-color: @black-hover;
  }

  &.active {
    background-color: @primary-color;
  }
}

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: @error-red;
  color: @white;
  padding: 15px 20px;
  border-radius: 5px;
  font-size: 16px;
  display: none;
  max-width: 80%;
  text-align: center;
}
</style>
