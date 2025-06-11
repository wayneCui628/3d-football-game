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

    // --- 将 accumulatedCurve (Vector2) 转换为 this.angularVelocity (Vector3) ---
    const MAX_SPIN_RATE = 15 * Math.PI; // 每秒最大旋转弧度 (例如 7.5圈/秒)

    // curveSensitivityFactor 用来将累积的鼠标位移 (accumulatedCurve.length())
    // 映射到一个合适的旋转强度比例 (0到1)
    // CONTROLS.MAX_ACCUMULATED_CURVE_MAGNITUDE 是你在 addCurve 中设定的最大累积值
    // 如果没有在 addCurve 中限制，你需要在这里估计一个典型输入的最大值
    const curveSensitivityFactor =
      accumulatedCurve.length() / CONTROLS.MAX_ACCUMULATED_CURVE_MAGNITUDE;
    // 或者用一个固定的缩放因子, e.g., 0.01

    let targetSpinRate = Math.min(1.0, curveSensitivityFactor) * MAX_SPIN_RATE; // 最终的旋转速率标量

    // 如果累积的 curve 值很小，则不施加明显旋转
    if (accumulatedCurve.lengthSq() < 10) {
      // 阈值，例如累积量小于10像素平方，视为无弧线
      targetSpinRate = 0;
    }

    this.angularVelocity.set(0, 0, 0); // 重置角速度

    if (targetSpinRate > 0.01) {
      // 归一化 accumulatedCurve 来得到2D方向
      const curveDir2D = accumulatedCurve.clone().normalize();

      // curveDir2D.x (原 movementX 累积) 控制绕Y轴的旋转 (左右弧线)
      // 符号可能需要调整：例如，鼠标向右 (curveDir2D.x > 0) 产生向右的球 (需要角速度 < 0)
      const spinY = -curveDir2D.x * targetSpinRate; // 负号用于调整方向

      // curveDir2D.y (原 movementY 累积) 控制绕球的侧向X轴的旋转 (上下弧线)
      // 这个轴垂直于球的飞行方向 (direction) 和世界Y轴
      const worldUp = new THREE.Vector3(0, 1, 0);
      const sideAxis = new THREE.Vector3().crossVectors(direction, worldUp);

      // 只有当球不是纯粹向上或向下飞时，sideAxis才有效
      if (sideAxis.lengthSq() > 0.001) {
        sideAxis.normalize();
        // 符号可能需要调整：例如，鼠标向下 (curveDir2D.y > 0) 产生下旋 (需要角速度 < 0 绕sideAxis)
        const spinAroundSide = -curveDir2D.y * targetSpinRate;

        // 将绕sideAxis的旋转分解到世界坐标系的角速度分量
        // (更简单的方式是直接使用 setFromAxisAngle，但我们是在构建角速度向量)
        // this.angularVelocity.set(0, spinY, 0);
        // this.angularVelocity.addScaledVector(sideAxis, spinAroundSide);

        // 或者，分别设置：
        // 绕Y轴的旋转贡献
        this.angularVelocity.y = spinY;

        // 绕侧向轴的旋转贡献
        // 将 sideAxis * spinAroundSide 的旋转加到 this.angularVelocity
        // 注意：如果直接加，可能会因为轴不正交导致问题。
        // 一个更稳健（但稍微复杂）的方式是分别计算由spinY和spinAroundSide产生的角速度，然后组合。
        // 简化处理：假设 spinY 和 spinAroundSide 是主要效果
        const angularVelFromSideSpin = sideAxis.multiplyScalar(spinAroundSide);
        this.angularVelocity.x += angularVelFromSideSpin.x;
        // this.angularVelocity.y += angularVelFromSideSpin.y; // Y分量已经由 spinY 贡献
        this.angularVelocity.z += angularVelFromSideSpin.z;
      } else {
        // 球几乎垂直飞行，主要施加绕Y轴的侧旋
        this.angularVelocity.set(0, spinY, 0);
      }

      // （可选）如果希望旋转轴严格垂直于飞行方向（对于纯侧旋或纯上/下旋）
      // 可以将 this.angularVelocity 投影到垂直于 direction 的平面上
      // 但通常由玩家输入直接映射的角速度效果更直观

      // (可选) 限制总角速度大小，以防组合后过大
      if (this.angularVelocity.length() > MAX_SPIN_RATE * 1.2) {
        // 允许组合后稍微超出一点
        this.angularVelocity.normalize().multiplyScalar(MAX_SPIN_RATE * 1.2);
      }
    }
    // console.log("Final Curve Vec2:", accumulatedCurve, "Target Spin Rate:", targetSpinRate, "Angular Velocity:", this.angularVelocity);
  }
  /**
   * 更新球的物理状态
   * @param deltaTime - 时间增量
   */
  public update(deltaTime: number): void {
    // 空气阻力
    const speed = this.velocity.length();
    const BALL_AREA = Math.PI * SIZES.BALL_RADIUS * SIZES.BALL_RADIUS; // 球的横截面积
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
    // 假设 this.angularVelocity (ω) 是在射门时设置的，代表球的旋转轴和快慢
    // 例如: this.angularVelocity = new THREE.Vector3(spinX, spinY, spinZ);
    if (
      this.angularVelocity &&
      this.angularVelocity.lengthSq() > 0.001 &&
      speed > 0.1
    ) {
      // 计算马格努斯力 F_magnus = C * (ω × v)
      // C 是一个系数，可以包含空气密度、球半径等，我们用一个简化的 MAGNUS_COEFFICIENT
      const magnusForceDirection = new THREE.Vector3().crossVectors(
        this.angularVelocity,
        this.velocity
      );

      // magnusForceDirection 的大小与 |ω|*|v|*sin(angle_between_them) 成正比
      // 我们需要将其归一化并乘以一个代表马GNUS效应强度的标量
      // 这个标量本身也可能与速度和角速度大小有关
      // 简化：力的方向由叉乘决定，大小由 magnusForceDirection.length() 和一个系数决定

      // PHYSICS.MAGNUS_COEFFICIENT 可以是一个综合了空气密度、球半径、旋转效率等的系数
      // 真实马格努斯力大小也与 speed 和 angularVelocity.length() 相关
      const magnusForceMagnitude =
        PHYSICS.MAGNUS_COEFFICIENT * magnusForceDirection.length();

      // 将方向向量归一化，然后乘以计算出的大小和deltaTime
      if (magnusForceDirection.lengthSq() > 0.0001) {
        // 避免除以零
        magnusForceDirection.normalize();
        const magnusForceImpulse = magnusForceDirection.multiplyScalar(
          magnusForceMagnitude * deltaTime
        );
        // console.log("Angular Vel:", this.angularVelocity, "Velocity:", this.velocity, "Magnus Impulse:", magnusForceImpulse);
        this.velocity.add(magnusForceImpulse);
      }
    }
    // 重力
    this.velocity.add(PHYSICS.GRAVITY.clone().multiplyScalar(deltaTime));

    // 更新位置
    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    // 旋转 (为了视觉效果，球的旋转应该主要由 this.angularVelocity 驱动，而不是速度)
    // 如果 this.angularVelocity 代表角速度 (弧度/秒)
    if (this.angularVelocity && this.angularVelocity.lengthSq() > 0.001) {
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
    } else {
      // 如果没有角速度（例如直线球或滚动时），可以使用旧的基于线速度的视觉旋转
      this.mesh.rotation.x += this.velocity.z * deltaTime * 2;
      this.mesh.rotation.z -= this.velocity.x * deltaTime * 2;
    }

    // 地面碰撞和摩擦
    if (this.mesh.position.y < SIZES.BALL_RADIUS) {
      this.mesh.position.y = SIZES.BALL_RADIUS;
      this.velocity.y *= -PHYSICS.RESTITUTION_COEFFICIENT;

      // 地面滚动摩擦
      if (Math.abs(this.velocity.y) < 0.5) {
        // 球在地面滚动或滑动
        const planarVelocity = this.velocity.clone().setY(0);
        const planarSpeedSq = planarVelocity.lengthSq();

        if (planarSpeedSq > 0.001) {
          // 动摩擦力 F_friction = μ * N (N是正向力，这里约等于mg)
          // 方向与平面速度相反
          const frictionMagnitude =
            PHYSICS.GROUND_FRICTION_FACTOR * Math.abs(PHYSICS.GRAVITY.y); // μ * g
          const frictionImpulseMagnitude = frictionMagnitude * deltaTime;

          if (Math.sqrt(planarSpeedSq) > frictionImpulseMagnitude / 1.0) {
            // 1.0是球的质量，假设为1
            // 施加摩擦力，减少平面速度
            planarVelocity
              .normalize()
              .multiplyScalar(-frictionImpulseMagnitude);
            this.velocity.x += planarVelocity.x;
            this.velocity.z += planarVelocity.z;
          } else {
            // 摩擦力足以使球停止在平面上的运动
            this.velocity.x = 0;
            this.velocity.z = 0;
            if (this.angularVelocity) {
              // 如果球停止了，它的旋转也应该因为摩擦逐渐停止
              this.angularVelocity.multiplyScalar(
                1 - PHYSICS.GROUND_FRICTION_FACTOR * 5 * deltaTime
              ); // 旋转衰减
            }
          }
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
