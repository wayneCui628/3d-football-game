<template>
  <div class="game-wrapper">
    <div ref="container" id="game-container" class="game-container"></div>
    <!-- 游戏UI -->
    <div class="game-ui">
      <!-- 准星 -->
      <div
        id="crosshair"
        class="crosshair"
        :style="{
          display: isPointerLocked && !isSlowMotionActive ? 'block' : 'none',
        }"
      >
        <div
          class="crosshair-dot"
          :style="{
            left: `${curve.x * 0.25 + 50}%`,
            top: `${curve.y * 0.25 + 50}%`,
          }"
        ></div>
      </div>

      <!-- 力量条 -->
      <div class="power-meter">
        <div
          class="power-fill"
          :style="{ width: `${(power / CONTROLS.MAX_POWER) * 100}%` }"
        ></div>
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
// import { Wall } from "@/models/wall";
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
// let wall: Wall;
let goalkeeper: Goalkeeper;

const power = ref(0);
const isCharging = ref(false);
const isPaused = ref(false);
const isPointerLocked = ref(false); // 是否锁定鼠标指针

const shotsCount = ref(0);
const goalsCount = ref(0);

let animationFrameId: number | null = null;
let lastShotTime = 0;

const curve = ref<THREE.Vector2>(new THREE.Vector2(0, 0)); // 用于显示弧线的指示器

let shootDirection = new THREE.Vector3();
let cameraAzimuth = 0; // 摄像机水平方位角 (绕Y轴)
let cameraElevation = Math.PI / 6; // 摄像机俯仰角 (初始向上看一点，例如30度)
const cameraDistance = 5; // 摄像机与玩家的固定距离
const cameraTargetOffset = new THREE.Vector3(0, 1.5, 0); // 摄像机看向玩家身上的偏移量 (例如，看向玩家胸部而不是脚底)
const mouseSensitivity = 0.0025;
const minElevation = -Math.PI / 12; // 最小俯仰角 (例如-60度)
const maxElevation = (Math.PI / 3) * 0.9; // 最大俯仰角 (例如接近90度，但不完全是，防止万向节锁问题)

const isSlowMotionActive = ref(false); // New state for slow motion
const SLOW_MOTION_FACTOR = 1; // New constant for slowdown
const BALL_FOLLOW_CAMERA_DISTANCE = 7; // Distance for camera when following ball

let ballFollowAzimuth = 0; // 围绕球的水平角度
let ballFollowElevation = Math.PI / 8; // 围绕球的垂直角度 (初始稍微抬高)
const ballFollowMouseSensitivity = 0.0025; // 围绕球旋转时的鼠标灵敏度
const minBallFollowElevation = -Math.PI / 3; // 最小仰角 (例如-60度)
const maxBallFollowElevation = Math.PI / 2.5; // 最大仰角 (例如72度)

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

// const createWall = () => {
//   wall = new Wall(scene, ball.getPosition(), -FIELD.LENGTH / 2);
// };

const createGoalkeeper = () => {
  goalkeeper = new Goalkeeper(scene, -FIELD.LENGTH / 2);
};

const setupEventListeners = () => {
  console.log("gameStarted:", gameStarted);
  // 请求鼠标锁定
  if (gameStarted) {
    renderer.domElement.requestPointerLock();
  }

  renderer.domElement.addEventListener("mousedown", (e) => {
    if (!gameStarted || !isPointerLocked.value || ball.isMoving()) return;
    if (e.button === 0) startCharging();
  });

  document.addEventListener("mouseup", (e) => {
    if (!gameStarted || !isPointerLocked.value || !isCharging.value) return;
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
  if (!gameStarted || !isPointerLocked.value) return;

  if (isSlowMotionActive.value) {
    // 优先检查慢动作状态
    ballFollowAzimuth -= event.movementX * ballFollowMouseSensitivity;
    // 假设鼠标向上移动 (movementY < 0) 意味着视角抬高 (增加仰角)
    // 这与你现有的 cameraElevation 逻辑可能需要统一
    // 如果你现有的 cameraElevation 是 movementY > 0 视角抬高，则这里也用 +=
    ballFollowElevation += event.movementY * ballFollowMouseSensitivity; // 尝试用减号，若反了则改为加号

    // 限制仰角范围
    ballFollowElevation = Math.max(
      minBallFollowElevation,
      Math.min(maxBallFollowElevation, ballFollowElevation)
    );
  } else if (isCharging.value) {
    addCurve(event.movementX, event.movementY);
  } else {
    // 更新普通模式下的摄像机方位角和俯仰角 (跟随玩家时)
    cameraAzimuth -= event.movementX * mouseSensitivity;
    cameraElevation += event.movementY * mouseSensitivity; // 你原始代码是 +=

    // 限制普通模式的俯仰角
    cameraElevation = Math.max(
      minElevation,
      Math.min(maxElevation, cameraElevation)
    );
  }
};

const onPointerLockChange = () => {
  isPointerLocked.value = document.pointerLockElement === renderer.domElement;
  if (!isPointerLocked.value) {
    console.log("Ttoggling pause state");
    isPaused.value = true;
  }

  if (!isPointerLocked.value && isCharging.value) {
    isCharging.value = false;
    power.value = 0;
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
    curve.value = new THREE.Vector2(0, 0); // 重置弧线方向
  }
};

const addCurve = (movementX: number, movementY: number) => {
  const addedCurveDelta = new THREE.Vector2(movementX, movementY);
  curve.value = curve.value.add(addedCurveDelta); // 累加鼠标移动的弧线方向
  if (curve.value.length() > CONTROLS.MAX_ACCUMULATED_CURVE_MAGNITUDE) {
    curve.value
      .normalize()
      .multiplyScalar(CONTROLS.MAX_ACCUMULATED_CURVE_MAGNITUDE);
  }
};

const shoot = () => {
  if (!isCharging.value) return;
  const shootSpeed = power.value * 0.3;
  console.log("Shooting with speed: ", shootSpeed, "m/s");

  isCharging.value = false;
  shotsCount.value++;
  const shotsCountEl = document.getElementById("shots-count");
  if (shotsCountEl) {
    shotsCountEl.textContent = shotsCount.value.toString();
  }
  updateSuccessRate();

  const ballStartPosition = ball.getPosition();
  // ... (射线计算和射门方向的逻辑保持不变) ...
  const cameraPositionForShot = camera.position.clone(); // 保存射门瞬间的相机位置
  const aimRayDirection = new THREE.Vector3();
  camera.getWorldDirection(aimRayDirection);
  const targetSphereRadius = 11.0;
  const groundLevelY = 0.0;

  const aimRay = new THREE.Ray(cameraPositionForShot, aimRayDirection);
  const targetSphere = new THREE.Sphere(ballStartPosition, targetSphereRadius);
  const intersectionPoint = new THREE.Vector3();
  const intersects = aimRay.intersectSphere(targetSphere, intersectionPoint);
  let adjustedTargetPosition = new THREE.Vector3();

  if (intersects) {
    adjustedTargetPosition.copy(intersectionPoint);
    if (adjustedTargetPosition.y < groundLevelY) {
      adjustedTargetPosition.y = groundLevelY;
    }
  } else {
    console.warn(
      "Aim ray does not intersect the 25m target sphere. Using fallback target."
    );
    adjustedTargetPosition
      .copy(ballStartPosition)
      .add(aimRayDirection.clone().multiplyScalar(targetSphereRadius));
    if (adjustedTargetPosition.y < groundLevelY) {
      adjustedTargetPosition.y = groundLevelY;
    }
  }

  shootDirection.subVectors(adjustedTargetPosition, ballStartPosition);

  if (shootDirection.lengthSq() < 0.0001) {
    console.warn(
      "Adjusted target is too close to ball start position. Using camera aim direction as fallback."
    );
    shootDirection.copy(aimRayDirection);
    if (shootDirection.y < 0) {
      shootDirection.y = 0;
      shootDirection.normalize();
      if (shootDirection.lengthSq() < 0.0001) {
        shootDirection.set(0, 0, -1);
      }
    }
  } else {
    shootDirection.normalize();
  }
  console.log(
    "Shoot Direction:",
    shootDirection.x.toFixed(2),
    shootDirection.y.toFixed(2),
    shootDirection.z.toFixed(2)
  );

  ball.move(shootDirection, shootSpeed, curve.value);

  // 激活慢动作
  isSlowMotionActive.value = true;

  // 初始化球体跟踪摄像机的角度，以实现平滑过渡
  if (ball && camera) {
    const currentBallPos = ball.getPosition();
    // 使用射门瞬间的相机位置 (cameraPositionForShot) 而不是 camera.position，因为后者可能在 lerp 中变化
    const offsetVector = new THREE.Vector3().subVectors(
      cameraPositionForShot,
      currentBallPos
    );

    const distanceToBall = offsetVector.length();

    if (distanceToBall > 0.01) {
      // 避免除以零
      // 计算仰角：Y分量 / 实际距离
      ballFollowElevation = Math.asin(offsetVector.y / distanceToBall);
      // 计算方位角：atan2(X分量, Z分量)
      // 这使得方位角=0时，摄像机在球的+Z方向（如果球门在-Z，则是在球的后方）
      ballFollowAzimuth = Math.atan2(offsetVector.x, offsetVector.z);
    } else {
      // 如果摄像机和球几乎在同一点，则使用默认值
      ballFollowAzimuth = 0; // 默认在球的正后方（假设球朝-Z运动）
      ballFollowElevation = Math.PI / 6; // 默认仰角30度
    }

    // 确保初始仰角在允许范围内
    ballFollowElevation = Math.max(
      minBallFollowElevation,
      Math.min(maxBallFollowElevation, ballFollowElevation)
    );
  } else {
    // 备用初始化 (理论上不应发生)
    ballFollowAzimuth = 0;
    ballFollowElevation = Math.PI / 8;
  }

  animateShot();
};

const animateShot = () => {
  let prevTime = performance.now();

  const shotLoop = (currentTime: number) => {
    animationFrameId = requestAnimationFrame(shotLoop);

    let deltaTime = (currentTime - prevTime) / 1000;
    // Clamp deltaTime to avoid large jumps if tab was inactive or performance issues
    deltaTime = Math.min(deltaTime, 0.05); // e.g., max step of 50ms (20 FPS min for physics)

    // Apply slow motion factor if active
    if (isSlowMotionActive.value) {
      deltaTime *= SLOW_MOTION_FACTOR;
    }
    prevTime = currentTime;

    if (
      ball.getVelocity().lengthSq() < 0.001 &&
      ball.getPosition().y <= SIZES.BALL_RADIUS + 0.01
    ) {
      ball.stop();
      if (!checkGoal()) showResult("未进球");
      setTimeout(() => resetBallAndPlayer(), 1500);
      cancelAnimationFrame(animationFrameId as number);
      animationFrameId = null;
      return;
    }

    ball.update(deltaTime); // Pass potentially slowed deltaTime
    checkCollisions();

    if (checkGoal()) {
      showResult("进球！GOAL!");
      goalsCount.value++;
      const goalsCountEl = document.getElementById("goals-count");
      if (goalsCountEl) {
        goalsCountEl.textContent = goalsCount.value.toString();
      }
      updateSuccessRate();
      setTimeout(() => resetBallAndPlayer(), 1500);
      cancelAnimationFrame(animationFrameId as number);
      animationFrameId = null;
      return;
    }

    if (checkOutOfBounds(currentTime)) {
      if (!checkGoal()) showResult("未进球");
      setTimeout(() => resetBallAndPlayer(), 1500);
      cancelAnimationFrame(animationFrameId as number);
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
  // const wallCollision = wall.checkCollision(
  //   ball.getPosition(),
  //   SIZES.BALL_RADIUS
  // );
  // if (wallCollision.collided) {
  //   const reflectDir = ball
  //     .getPosition()
  //     .clone()
  //     .sub(wallCollision.playerPosition)
  //     .normalize();
  //   const speedBeforeHit = ball.getVelocity().length();
  //   ball.move(reflectDir, speedBeforeHit * PHYSICS.RESTITUTION_COEFFICIENT);
  //   showResult("击中人墙!");
  //   return;
  // }

  // 守门员扑救
  const saveResult = goalkeeper.checkSave(
    ball.getPosition(),
    ball.getVelocity()
  );
  if (saveResult.saved) {
    if (saveResult.saveType === "caught") {
      // ---- 守门员抱住球 ----
      showResult("守门员抱住了球!");
      ball.stop(); // 球停止运动
      setTimeout(() => resetBallAndPlayer(), 1500);
      cancelAnimationFrame(animationFrameId as number); // 停止射门动画循环
      animationFrameId = null;
      return; // 既然抱住了，就不用处理反弹了
    } else if (saveResult.saveType === "parried") {
      showResult("守门员扑出!");
      const reflectDir = ball
        .getPosition()
        .clone()
        .sub(saveResult.goalkeeperPosition!) // 确保 goalkeeperPosition 存在
        .normalize();

      if (
        saveResult.deflectionAngleFactor &&
        saveResult.deflectionAngleFactor > 0
      ) {
        const randomAngle =
          (Math.random() - 0.5) *
          Math.PI *
          0.1 *
          saveResult.deflectionAngleFactor; // 调整随机角度范围
        reflectDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), randomAngle); // 绕Y轴旋转一点
      }

      const speedBeforeHit = ball.getVelocity().length();
      const newSpeed = speedBeforeHit * saveResult.deflectionStrength!; // 使用返回的力量系数

      ball.move(reflectDir, newSpeed); // 用新的速度和方向移动球
    }
    return;
  }

  // 门框碰撞
  checkGoalpostCollision();
};

const checkGoalpostCollision = () => {
  const ballPosition = ball.getPosition();
  const currentBallVelocity = ball.getVelocity(); // 获取球的当前速度向量 (假设是克隆)
  let newVelocity = currentBallVelocity.clone(); // 用于计算新的速度
  let collisionOccurred = false;

  const postCheckBuffer = SIZES.BALL_RADIUS * 1.5; // 可以适当调整
  const goalLineZ = -FIELD.LENGTH / 2; // 球门线的Z坐标

  // 优化：只在球大致在球门区域内才进行详细检测
  if (
    Math.abs(ballPosition.x) >
      FIELD.GOAL_WIDTH / 2 + SIZES.BALL_RADIUS + postCheckBuffer ||
    Math.abs(ballPosition.z - goalLineZ) >
      FIELD.GOAL_DEPTH + SIZES.BALL_RADIUS + postCheckBuffer || // FIELD.GOAL_DEPTH 应该是门柱的厚度或一个小的Z范围
    ballPosition.y > FIELD.GOAL_HEIGHT + SIZES.BALL_RADIUS + postCheckBuffer ||
    ballPosition.y < -SIZES.BALL_RADIUS - postCheckBuffer // 考虑球可能从地面以下过来（虽然不太可能）
  ) {
    return; // 球离球门太远
  }

  const combinedRadius = SIZES.BALL_RADIUS + FIELD.POST_RADIUS;

  // --- 立柱检测 ---
  const posts = [
    { x: -FIELD.GOAL_WIDTH / 2, name: "左门柱" },
    { x: FIELD.GOAL_WIDTH / 2, name: "右门柱" },
  ];

  for (const post of posts) {
    // 检查Y方向是否在门柱高度范围内
    if (
      ballPosition.y <= FIELD.GOAL_HEIGHT + SIZES.BALL_RADIUS &&
      ballPosition.y >= 0
    ) {
      // 计算球心到门柱中心在XZ平面的距离
      const distSqXZ =
        (ballPosition.x - post.x) ** 2 + (ballPosition.z - goalLineZ) ** 2;

      if (distSqXZ <= combinedRadius ** 2) {
        collisionOccurred = true;
        showResult(`中${post.name}!`);

        // 1. 计算碰撞点法线 (近似)
        //    从门柱中心指向球心的向量 (只考虑XZ平面)
        const normal = new THREE.Vector3(
          ballPosition.x - post.x,
          0,
          ballPosition.z - goalLineZ
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
        ball.updatePosition(
          ballPosition.add(
            normal.clone().multiplyScalar(penetrationDepth + 0.001)
          )
        );

        break; // 一次只处理一次碰撞
      }
    }
  }

  if (collisionOccurred) {
    const finalSpeed = newVelocity.length(); // 碰撞后的速度大小
    const finalDirection = newVelocity.clone().normalize(); // 碰撞后的速度方向 (单位向量)
    ball.move(finalDirection, finalSpeed);
    return;
  }

  // --- 横梁检测 ---
  // 横梁的Z坐标也应该是 goalLineZ
  // 横梁可以看作一个沿X轴的圆柱体或长方体
  // 简化检测：先看X, Z是否在范围内，再看Y是否碰撞
  if (
    Math.abs(ballPosition.x) < FIELD.GOAL_WIDTH / 2 - FIELD.POST_RADIUS && // 在两个立柱之间
    Math.abs(ballPosition.z - goalLineZ) < SIZES.BALL_RADIUS + FIELD.POST_RADIUS // Z方向上接近横梁
  ) {
    const distSqYZ =
      (ballPosition.y - FIELD.GOAL_HEIGHT) ** 2 +
      (ballPosition.z - goalLineZ) ** 2;
    if (distSqYZ <= combinedRadius ** 2) {
      collisionOccurred = true;
      showResult("中楣!");

      // 1. 计算碰撞点法线 (近似)
      const normal = new THREE.Vector3(
        0,
        ballPosition.y - FIELD.GOAL_HEIGHT,
        ballPosition.z - goalLineZ
      ).normalize();

      // 2. 计算反射速度
      const dot = currentBallVelocity.dot(normal);
      const reflection = normal.clone().multiplyScalar(2 * dot);
      newVelocity
        .sub(reflection)
        .multiplyScalar(PHYSICS.POST_RESTITUTION_COEFFICIENT);

      // 3. 将球移出碰撞体
      const penetrationDepth = combinedRadius - Math.sqrt(distSqYZ);
      const newBallPosition = ballPosition.add(
        normal.clone().multiplyScalar(penetrationDepth + 0.001)
      );
      ball.updatePosition(newBallPosition);
    }
  }

  if (collisionOccurred) {
    const finalSpeed = newVelocity.length();
    const finalDirection = newVelocity.clone().normalize();
    ball.move(finalDirection, finalSpeed);
  }
};

const checkGoal = () => {
  const goalLine = -FIELD.LENGTH / 2;
  const inGoalPlane =
    ball.getPosition().z < goalLine - SIZES.BALL_RADIUS &&
    ball.getPosition().z > goalLine - FIELD.GOAL_DEPTH - SIZES.BALL_RADIUS;
  return (
    inGoalPlane &&
    Math.abs(ball.getPosition().x) < FIELD.GOAL_WIDTH / 2 - SIZES.BALL_RADIUS &&
    ball.getPosition().y <= FIELD.GOAL_HEIGHT - SIZES.BALL_RADIUS &&
    ball.getPosition().y >= SIZES.BALL_RADIUS
  );
};

const checkOutOfBounds = (currentTime) => {
  if (currentTime - lastShotTime <= 500) return false;

  const goalLineToCheck = -FIELD.LENGTH / 2;
  const behindGoal = ball.getPosition().z < goalLineToCheck - SIZES.BALL_RADIUS;
  const sideOut =
    Math.abs(ball.getPosition().x) > FIELD.WIDTH / 2 + SIZES.BALL_RADIUS;

  return behindGoal || sideOut /* || tooHighAndPast */;
};

const resetBallAndPlayer = (initialPosition: THREE.Vector3 | null = null) => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Deactivate slow motion HERE
  isSlowMotionActive.value = false;

  if (initialPosition) {
    ball.stop();
    ball.getPosition().copy(initialPosition);
  } else {
    ball.reset();
  }

  if (player) {
    player.reset();
  }

  // Reset camera aiming angles, not full rotation object
  cameraAzimuth = 0; // Reset horizontal aim to forward
  cameraElevation = Math.PI / 6; // Reset vertical aim to default
  power.value = 0;
  curve.value = new THREE.Vector2(0, 0); // Reset curve direction
  isCharging.value = false;

  updateCamera(); // Ensure camera updates to new player position
  // createWall();
};

const updateCamera = () => {
  if (!camera) return;

  if (
    isSlowMotionActive.value &&
    ball &&
    (ball.isMoving() || animationFrameId !== null)
  ) {
    // 保持跟踪直到动画结束
    // --- 慢动作: 摄像机围绕球体旋转 ---
    const ballPosition = ball.getPosition();

    // 根据方位角、仰角和距离计算摄像机的偏移量
    // x = r * cos(elevation) * sin(azimuth)
    // y = r * sin(elevation)
    // z = r * cos(elevation) * cos(azimuth)
    const offsetX =
      BALL_FOLLOW_CAMERA_DISTANCE *
      Math.cos(ballFollowElevation) *
      Math.sin(ballFollowAzimuth);
    const offsetY = BALL_FOLLOW_CAMERA_DISTANCE * Math.sin(ballFollowElevation);
    const offsetZ =
      BALL_FOLLOW_CAMERA_DISTANCE *
      Math.cos(ballFollowElevation) *
      Math.cos(ballFollowAzimuth);

    // 目标摄像机位置 = 球的位置 + 偏移量
    const targetCameraPosition = new THREE.Vector3(
      ballPosition.x + offsetX,
      ballPosition.y + offsetY, // Y轴直接使用计算出的偏移
      ballPosition.z + offsetZ
    );

    // 确保摄像机不会低于某个最小高度 (例如，略高于地面)
    // SIZES.BALL_RADIUS 可能指的是球心到地面的距离，所以相机最低点可以设置为这个值或稍小一点的值。
    targetCameraPosition.y = Math.max(
      targetCameraPosition.y,
      SIZES.BALL_RADIUS * 0.5
    ); // 调整这个0.5因子，或者设为固定值如0.2

    // 平滑地移动摄像机到目标位置
    camera.position.lerp(targetCameraPosition, 0.12); // 可以调整 0.12 这个插值因子

    // 让摄像机始终朝向球心
    camera.lookAt(ballPosition);
  } else if (player) {
    // --- 正常状态: 摄像机跟随玩家 (您原有的逻辑) ---
    const playerPosition = player.getGroup().position.clone();
    const offsetX =
      cameraDistance * Math.cos(cameraElevation) * Math.sin(cameraAzimuth);
    const offsetY = cameraDistance * Math.sin(cameraElevation);
    const offsetZ =
      cameraDistance * Math.cos(cameraElevation) * Math.cos(cameraAzimuth);

    const cameraIdealPosition = new THREE.Vector3(
      playerPosition.x + offsetX,
      playerPosition.y + offsetY + cameraTargetOffset.y,
      playerPosition.z + offsetZ
    );

    camera.position.lerp(cameraIdealPosition, 0.15);

    // 跟随玩家时，看向球的位置加上一个偏移 (例如，瞄准球的上方一点)
    const lookAtTarget = ball.getPosition().clone().add(cameraTargetOffset);
    camera.lookAt(lookAtTarget);
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
    power.value += CONTROLS.POWER_CHARGE_SPEED;
    if (power.value >= CONTROLS.MAX_POWER) {
      power.value = CONTROLS.MAX_POWER;
    }
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
    // createWall();
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
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid @white;
  display: none;
  .crosshair-dot {
    position: absolute;
    width: 4px;
    height: 4px;
    background-color: @white;
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }
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
