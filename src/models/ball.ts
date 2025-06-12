import * as THREE from "three";
import { SIZES, PHYSICS, CONTROLS } from "@/stores/constants";

export class Ball {
  private scene: THREE.Scene;
  private initialPosition: THREE.Vector3;
  private velocity: THREE.Vector3;
  private curve: THREE.Vector2; // 曲线量
  private angularVelocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0); // 球的角速度
  private mesh: THREE.Mesh;
  private renderer: THREE.WebGLRenderer | undefined;

  constructor(
    scene: THREE.Scene,
    initialPosition: THREE.Vector3,
    renderer?: THREE.WebGLRenderer
  ) {
    this.scene = scene;
    this.initialPosition = initialPosition;
    this.velocity = new THREE.Vector3();
    this.renderer = renderer;
    this.createBall();
  }

  private createBall(): void {
    const geometry = new THREE.IcosahedronGeometry(SIZES.BALL_RADIUS, 3); // 保持使用IcosahedronGeometry

    const textureLoader = new THREE.TextureLoader();
    const texturePath = "/assets/football.png";

    const ballTexture = textureLoader.load(
      texturePath,
      // onLoad callback
      (texture) => {
        console.log("Ball texture loaded successfully!");
        texture.colorSpace = THREE.SRGBColorSpace; // 非常重要！

        // 需要 renderer 实例来获取 maxAnisotropy
        if (this.renderer) {
          texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        } else {
          texture.anisotropy = 16; // 一个常见的默认值
        }

        // 如果材质已经创建并添加到物体，可以手动触发更新：
        if (
          this.mesh &&
          this.mesh.material instanceof THREE.MeshStandardMaterial
        ) {
          this.mesh.material.needsUpdate = true;
        }
      },
      // onProgress callback (可选)
      undefined,
      (error) => {
        console.error(
          `An error occurred loading the ball texture from ${texturePath}:`,
          error
        );
      }
    );

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff, // 基础颜色，如果纹理加载失败或纹理有透明部分会透出
      roughness: 0.3, // 根据你的纹理和期望效果调整
      metalness: 0.1, // 根据你的纹理和期望效果调整
      map: ballTexture, // 应用纹理
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.initialPosition);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
  }

  public move(
    direction: THREE.Vector3,
    speed: number,
    accumulatedCurve: THREE.Vector2 = new THREE.Vector2(0, 0)
  ): void {
    this.velocity.copy(direction).multiplyScalar(speed);
    const MAX_SPIN_RATE = 15 * Math.PI; // 每秒最大旋转弧度 (例如 7.5圈/秒)

    let curveIntensity =
      accumulatedCurve.length() / CONTROLS.MAX_ACCUMULATED_CURVE_MAGNITUDE;
    curveIntensity = Math.min(1.0, Math.max(0.0, curveIntensity)); // 限制在 0-1
    curveIntensity = Math.pow(curveIntensity, 0.75); // 例如用0.75次方

    let targetSpinRate = curveIntensity * MAX_SPIN_RATE; // 最终的旋转速率标量

    const MIN_ACCUMULATED_CURVE_FOR_INTENTIONAL_SPIN_SQ =
      (CONTROLS.MAX_ACCUMULATED_CURVE_MAGNITUDE * 0.1) ** 2;

    // 小输入阈值
    if (
      accumulatedCurve.lengthSq() <
      (CONTROLS.MAX_ACCUMULATED_CURVE_MAGNITUDE * 0.1) ** 2
    ) {
      // 例如，小于最大输入10%的平方
      targetSpinRate = 0;
    }

    this.angularVelocity.set(0, 0, 0); // 重置角速度

    if (
      targetSpinRate > 0.01 &&
      accumulatedCurve.lengthSq() >
        MIN_ACCUMULATED_CURVE_FOR_INTENTIONAL_SPIN_SQ
    ) {
      // 归一化 accumulatedCurve 来得到2D方向
      const curveDir2D = accumulatedCurve.clone().normalize();

      // curveDir2D.x (原 movementX 累积) 控制绕Y轴的旋转 (左右弧线)
      const spinY_magnitude = Math.abs(curveDir2D.x) * targetSpinRate;
      this.angularVelocity.y = -Math.sign(curveDir2D.x) * spinY_magnitude;

      // curveDir2D.y (原 movementY 累积) 控制绕球的侧向X轴的旋转 (上下弧线)
      // 这个轴垂直于球的飞行方向 (direction) 和世界Y轴
      const worldUp = new THREE.Vector3(0, 1, 0);
      const sideAxis = new THREE.Vector3().crossVectors(direction, worldUp);

      // 只有当球不是纯粹向上或向下飞时，sideAxis才有效
      if (sideAxis.lengthSq() > 0.001) {
        sideAxis.normalize();

        const spinAroundSide_magnitude =
          Math.abs(curveDir2D.y) * targetSpinRate;

        const spinAroundSide_signed =
          -Math.sign(curveDir2D.y) * spinAroundSide_magnitude; // 符号根据实际效果调整

        // 将绕 sideAxis 的角速度贡献到 this.angularVelocity
        const angularVel_SideSpin = sideAxis.multiplyScalar(
          spinAroundSide_signed
        );

        // angularVel_SideSpin 贡献X和Z (以及可能的Y，如果飞行方向不是纯水平)
        this.angularVelocity.x += angularVel_SideSpin.x;
        this.angularVelocity.z += angularVel_SideSpin.z;
        if (Math.abs(sideAxis.y) > 0.01) {
          this.angularVelocity.y += angularVel_SideSpin.y; // 尝试也加上，看看效果
        }
      }

      //  限制总角速度大小，以防组合后过大
      if (this.angularVelocity.length() > MAX_SPIN_RATE * 1.2) {
        // 允许组合后稍微超出一点
        this.angularVelocity.normalize().multiplyScalar(MAX_SPIN_RATE * 1.2);
      }
    } else {
      // --- 没有明显曲线输入，添加轻微的自然旋转 ---
      const NATURAL_SPIN_MAX_RATE = 2 * Math.PI;
      const randomSpinRate = Math.random() * NATURAL_SPIN_MAX_RATE;

      if (randomSpinRate > 0.01) {
        // 只有当随机速率大于一个小阈值才施加
        // 创建一个随机的3D旋转轴 (需要归一化)
        const randomAxis = new THREE.Vector3(
          Math.random() * 2 - 1, // -1 to 1
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        );
        if (randomAxis.lengthSq() > 0.001) {
          // 避免零向量
          randomAxis.normalize();
          this.angularVelocity.copy(randomAxis).multiplyScalar(randomSpinRate);
        }
      }
    }
  }
  /**
   * 更新球的物理状态
   * @param deltaTime - 时间增量
   */
  public update(deltaTime: number): void {
    const speed = this.velocity.length();
    const BALL_AREA = Math.PI * SIZES.BALL_RADIUS * SIZES.BALL_RADIUS; // 球的横截面积
    const CL_SLOPE = 1.0; // C_L = CL_SLOPE * S
    const INERTIA_SCALAR = 2 / 5; // 对于实心球体 I = (2/5)mr² 的系数部分
    const BALL_INERTIA =
      INERTIA_SCALAR * SIZES.BALL_MASS * SIZES.BALL_RADIUS ** 2; // 转动惯量

    // 空气阻力
    if (speed > 0.01) {
      const dragMagnitude =
        0.5 *
        PHYSICS.RHO *
        speed *
        speed *
        PHYSICS.AIR_RESISTANCE_FACTOR *
        BALL_AREA;
      const accelerationDueToDrag = dragMagnitude / SIZES.BALL_MASS; // a = F/m
      const dragForce = this.velocity
        .clone()
        .normalize()
        .multiplyScalar(-accelerationDueToDrag * deltaTime);
      this.velocity.add(dragForce);
    }

    // 曲线效果 (马格努斯效应)
    if (
      this.angularVelocity &&
      this.angularVelocity.lengthSq() > 0.001 &&
      speed > 0.1
    ) {
      // 1. 计算角速度中垂直于线速度的分量 ω_perp (的模)
      //    ω_perp = |ω x v_normalized| = |ω| * sin(θ)
      //    其中 v_normalized 是单位速度向量, θ 是 ω 和 v 之间的夹角
      const velocityNormalized = this.velocity.clone().normalize();
      const omega_cross_v_normalized = new THREE.Vector3().crossVectors(
        this.angularVelocity,
        velocityNormalized
      );
      const omega_perp_magnitude = omega_cross_v_normalized.length(); // |ω_perp|

      // 2. 计算自旋比 S
      let spinRatio = 0;
      if (speed > 0.01) {
        // 避免除以零
        spinRatio = (omega_perp_magnitude * SIZES.BALL_RADIUS) / speed; // S = (ω_perp * r) / v
      }
      // 3. 计算升力系数 C_L (使用策略A：线性关系并限制最大值 )
      let cL = CL_SLOPE * spinRatio;
      // cL = Math.min(cL, MAX_CL);
      cL = Math.max(cL, 0); // 确保C_L不为负

      // 4. 计算马格努斯力的大小 F_m
      // F_m = 0.5 * ρ * A * C_L * v^2
      const magnusForceMagnitude =
        0.5 * PHYSICS.RHO * BALL_AREA * cL * speed * speed;

      // 5. 确定马格努斯力的方向 (ω × v)
      //    我们已经有了 omega_cross_v_normalized，它的方向是 ω × v_normalized
      //    所以它就是马格努斯力的方向。
      const magnusForceDirection = omega_cross_v_normalized; // 它已经是 ω x v_normalized 了

      if (magnusForceDirection.lengthSq() > 0.0001) {
        // magnusForceDirection 已经是单位向量了，因为它来自 cross(ω, v_normalized) 然后取length是 |ω_perp|
        // 如果 omega_cross_v_normalized 直接用作方向，它的大小是 |ω_perp|
        // 为了得到单位方向向量，我们需要归一化 omega_cross_v_normalized
        // 另一种方法是直接用 ω x v，然后归一化
        const actual_magnus_force_dir = new THREE.Vector3().crossVectors(
          this.angularVelocity,
          this.velocity
        );
        if (actual_magnus_force_dir.lengthSq() < 0.00001) {
          // ω 和 v 平行或其中一个为0
          return; // 没有马格努斯力
        }
        actual_magnus_force_dir.normalize();

        // 6. 计算马格努斯力对速度的改变 (冲量 / 质量)
        //    Δv = (F_m / mass) * Δt
        //    你需要球的质量 BALL_MASS
        if (SIZES.BALL_MASS <= 0)
          throw new Error("Ball mass must be positive."); // 防御性编程

        const magnusAccelerationMagnitude =
          magnusForceMagnitude / SIZES.BALL_MASS; // a = F/m
        const magnusVelocityChange = actual_magnus_force_dir.multiplyScalar(
          magnusAccelerationMagnitude * deltaTime // Δv = a * Δt
        );

        this.velocity.add(magnusVelocityChange);
      }
    }

    // 重力
    this.velocity.add(PHYSICS.GRAVITY.clone().multiplyScalar(deltaTime));

    // 更新位置
    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    // 旋转 (为了视觉效果，球的旋转应该主要由 this.angularVelocity 驱动，而不是速度)
    // 如果 this.angularVelocity 代表角速度 (弧度/秒)

    if (this.angularVelocity && this.angularVelocity.lengthSq() > 0.001) {
      // 角速度衰减
      this.angularVelocity.multiplyScalar(
        1.0 - PHYSICS.AIR_SPIN_DECAY_RATE * deltaTime
      );
      // 创建一个四元数来表示这一帧的旋转增量
      const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(
        this.angularVelocity.clone().normalize(), // 旋转轴
        this.angularVelocity.length() * deltaTime // 旋转角度 = 角速度大小 * 时间
      );
      // 将此旋转应用到球的当前朝向四元数上
      this.mesh.quaternion.multiplyQuaternions(
        rotationQuaternion,
        this.mesh.quaternion
      );
    }

    // 地面碰撞和反弹 (这部分保持不变)
    if (this.mesh.position.y < SIZES.BALL_RADIUS) {
      this.mesh.position.y = SIZES.BALL_RADIUS;
      if (Math.abs(this.velocity.y) < 0.1) this.velocity.y = 0;

      // --- 地面滚动和滑动摩擦 ---
      const MIN_Y_VELOCITY_FOR_STABLE_CONTACT = 0.2; // 用来判断是否稳定接触地面
      const ALMOST_ZERO_SPEED = 0.08; // 用于判断线速度或角速度是否接近停止

      if (this.velocity.y < 0) {
        // 确保是向下运动时触发碰撞
        const v_y_in = this.velocity.y; // 入射垂直速度 (负值)

        // 1. 计算接触点滑动速度 (在垂直速度反转前计算)
        const planarVelocityIn = new THREE.Vector3(
          this.velocity.x,
          0,
          this.velocity.z
        );
        const r_contact = new THREE.Vector3(0, -SIZES.BALL_RADIUS, 0);
        const rotationalVelocityAtContactIn = new THREE.Vector3().crossVectors(
          this.angularVelocity,
          r_contact
        );
        const slipVelocityIn = new THREE.Vector3().addVectors(
          planarVelocityIn,
          rotationalVelocityAtContactIn
        );

        // --- 处理垂直速度反弹 (这部分不变) ---
        this.velocity.y *= -PHYSICS.RESTITUTION_COEFFICIENT; // v_y_out

        // --- 计算法向冲量大小 (J_n) ---
        // J_n = m * (v_y_out - v_y_in)
        const J_n_magnitude = SIZES.BALL_MASS * (this.velocity.y - v_y_in); // v_y_out 是正, v_y_in 是负, 所以 J_n 是正

        // --- 如果有滑动，计算并施加摩擦冲量对角速度的影响 ---
        if (slipVelocityIn.lengthSq() > 0.0001) {
          // 如果存在切向滑动
          const slipDirection = slipVelocityIn.clone().normalize();

          // 动摩擦冲量大小 J_f = μ_k * J_n
          const J_f_magnitude = PHYSICS.GROUND_FRICTION_FACTOR * J_n_magnitude;

          // 动摩擦冲量向量 (方向与滑动方向相反)
          const frictionImpulseVector = slipDirection.multiplyScalar(
            -J_f_magnitude
          );

          // 摩擦冲量也会影响线速度 (通常在更完整的碰撞模型中一起求解，这里简化)
          this.velocity.x += frictionImpulseVector.x / SIZES.BALL_MASS;
          this.velocity.z += frictionImpulseVector.z / SIZES.BALL_MASS;
          // 注意：如果在这里改变了线速度，那么后续的滚动摩擦逻辑也需要知道这一点。
          // 为了逐步改进，可以先只专注于对角速度的影响。

          // 冲量力矩 τ_impulse = r_contact × J_f_vector
          const torqueImpulseVector = new THREE.Vector3().crossVectors(
            r_contact,
            frictionImpulseVector
          );

          // 角速度改变量 Δω = τ_impulse / I
          const angularVelocityChange =
            torqueImpulseVector.divideScalar(BALL_INERTIA);

          this.angularVelocity.add(angularVelocityChange);
        }
      }

      if (Math.abs(this.velocity.y) < MIN_Y_VELOCITY_FOR_STABLE_CONTACT) {
        this.velocity.y = 0; // 假设在稳定接触后，垂直速度近似为0 (避免微小反弹)

        const planarVelocity = new THREE.Vector3(
          this.velocity.x,
          0,
          this.velocity.z
        );
        const planarSpeed = planarVelocity.length();

        // 计算地面接触点相对于球心的速度 (v_contact = v_planar + ω × r_contact)
        // r_contact 是从球心指向地面接触点的向量: (0, -BALL_RADIUS, 0)
        const r_contact = new THREE.Vector3(0, -SIZES.BALL_RADIUS, 0);
        const rotationalVelocityAtContact = new THREE.Vector3().crossVectors(
          this.angularVelocity,
          r_contact
        );
        const contactPointVelocity = new THREE.Vector3().addVectors(
          planarVelocity,
          rotationalVelocityAtContact
        );
        const contactPointSpeed = contactPointVelocity.length();

        if (contactPointSpeed > ALMOST_ZERO_SPEED) {
          // 只有当接触点有相对滑动时才有滑动摩擦力
          // 动摩擦力 F_friction = μ * N (N是正向力，这里约等于mg)
          // 方向与接触点滑动速度相反
          const N = SIZES.BALL_MASS * Math.abs(PHYSICS.GRAVITY.y); // 正向力
          const frictionMagnitude = PHYSICS.GROUND_FRICTION_FACTOR * N; // 滑动摩擦力大小 μ * N

          const frictionDirection = contactPointVelocity
            .clone()
            .normalize()
            .multiplyScalar(-1);
          const frictionForceVector = frictionDirection
            .clone()
            .multiplyScalar(frictionMagnitude);

          // 1. 摩擦力对线速度的影响 (改变球心的平动)
          const linearAcceleration = frictionForceVector
            .clone()
            .divideScalar(SIZES.BALL_MASS); // a = F/m
          const linearVelocityChange = linearAcceleration
            .clone()
            .multiplyScalar(deltaTime); // Δv = a * Δt

          // 检查摩擦力是否足以使接触点滑动停止 (或者说，使球达到纯滚动或完全停止)
          // 这是一个简化：如果摩擦力产生的速度变化大于当前滑动速度，则认为滑动停止
          if (contactPointSpeed > linearVelocityChange.length()) {
            // 这里用 linearVelocityChange.length() 作为比较基准不够精确，但作为简化
            this.velocity.x += linearVelocityChange.x;
            this.velocity.z += linearVelocityChange.z;
          } else {
            const targetPlanarVelForPureRolling = new THREE.Vector3()
              .crossVectors(this.angularVelocity, r_contact)
              .multiplyScalar(-1);
            targetPlanarVelForPureRolling.y = 0; //确保是平面速度
            this.velocity.x = targetPlanarVelForPureRolling.x; // (或者用 lerp 平滑过渡)
            this.velocity.z = targetPlanarVelForPureRolling.z;
            // 如果角速度也很小，就让它们都停下来
            if (
              this.angularVelocity.length() < ALMOST_ZERO_SPEED &&
              planarSpeed < ALMOST_ZERO_SPEED
            ) {
              this.velocity.x = 0;
              this.velocity.z = 0;
              this.angularVelocity.set(0, 0, 0);
            }
          }

          // 2. 摩擦力对角速度的影响 (改变球的转动)
          // 力矩 τ = r_contact × F_friction
          const torqueVector = new THREE.Vector3().crossVectors(
            r_contact,
            frictionForceVector
          );
          const angularAcceleration = torqueVector
            .clone()
            .divideScalar(BALL_INERTIA); // α = τ / I
          const angularVelocityChange = angularAcceleration
            .clone()
            .multiplyScalar(deltaTime); // Δω = α * Δt

          this.angularVelocity.add(angularVelocityChange);
        } else {
          // 接触点几乎没有相对滑动 (球在纯滚动或已停止)
          // 如果是纯滚动，理论上只有滚动摩擦力 (通常远小于滑动摩擦力)
          // 为了简化，我们可以假设此时球的线性减速和角速度减速是由于一个等效的滚动阻力
          if (planarSpeed > ALMOST_ZERO_SPEED) {
            const ROLLING_RESISTANCE_FACTOR =
              PHYSICS.GROUND_FRICTION_FACTOR * 0.1; // 滚动阻力系数远小于滑动摩擦系数
            const rollingResistanceForceMag =
              ROLLING_RESISTANCE_FACTOR *
              SIZES.BALL_MASS *
              Math.abs(PHYSICS.GRAVITY.y);
            const rollingResistanceLinAccel =
              rollingResistanceForceMag / SIZES.BALL_MASS;
            const rollingLinVelChange = planarVelocity
              .clone()
              .normalize()
              .multiplyScalar(-rollingResistanceLinAccel * deltaTime);
            if (planarSpeed > rollingLinVelChange.length()) {
              this.velocity.x += rollingLinVelChange.x;
              this.velocity.z += rollingLinVelChange.z;
            } else {
              this.velocity.x = 0;
              this.velocity.z = 0;
            }
          }

          // 角速度也因为滚动阻力而衰减 (试图维持 v = ωr)
          // 当线速度减小时，角速度也应相应减小以保持纯滚动（或一起停止）
          if (this.angularVelocity.length() > ALMOST_ZERO_SPEED) {
            // 一个简单的衰减，也可以基于线速度的衰减来计算角速度的衰减
            this.angularVelocity.multiplyScalar(
              1.0 - PHYSICS.GROUND_SPIN_DECAY_RATE * deltaTime
            );
            // 尝试让角速度与线速度匹配纯滚动条件
            if (
              planarSpeed < ALMOST_ZERO_SPEED &&
              this.angularVelocity.length() > ALMOST_ZERO_SPEED * 2
            ) {
              // 线速度停了但还在转
              this.angularVelocity.multiplyScalar(0.5); // 加速停止
            }
          }
        }

        // 如果球几乎完全停止了
        if (
          this.velocity.lengthSq() < ALMOST_ZERO_SPEED * ALMOST_ZERO_SPEED &&
          this.angularVelocity.lengthSq() <
            ALMOST_ZERO_SPEED * ALMOST_ZERO_SPEED
        ) {
          this.velocity.set(0, 0, 0);
          this.angularVelocity.set(0, 0, 0);
        }
      }
    }
  }

  public applyForce(force: THREE.Vector3): void {
    // 将力应用到球的速度上
    this.velocity.add(force);
    // 确保球的速度不会过大
    const maxSpeed = CONTROLS.MAX_POWER * 0.4 * 2; // 可以根据需要调整最大速度
    if (this.velocity.lengthSq() > maxSpeed ** 2) {
      this.velocity.normalize().multiplyScalar(maxSpeed);
    }
  }

  public updatePosition(newPosition: THREE.Vector3): void {
    // 更新球的位置
    this.mesh.position.copy(newPosition);
    // 确保球停在地面上
    if (this.mesh.position.y < SIZES.BALL_RADIUS) {
      this.mesh.position.y = SIZES.BALL_RADIUS;
    }
  }

  public stop(): void {
    this.velocity.set(0, 0, 0);
    this.mesh.position.y = SIZES.BALL_RADIUS; // 确保球停在地面上
  }

  public reset(): void {
    this.mesh.position.copy(this.initialPosition as THREE.Vector3);
    this.mesh.rotation.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
  }

  public isMoving(): boolean {
    return this.velocity.lengthSq() > 0.0001;
  }

  public isStopped(): boolean {
    return !this.isMoving() && this.mesh.position.y <= SIZES.BALL_RADIUS + 0.01;
  }

  public getMesh(): THREE.Mesh {
    return this.mesh.clone();
  }

  public getVelocity(): THREE.Vector3 {
    return this.velocity.clone();
  }

  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }
}
