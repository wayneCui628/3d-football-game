import * as THREE from "three";
import { SIZES, FIELD, CONTROLS, PHYSICS } from "@/stores/constants";

// 定义扑救结果的类型
interface DetailedSaveResult {
  saved: boolean; // 是否扑救成功
  saveType?: "caught" | "parried" | "deflected"; // 扑救类型: caught(抱住), parried(扑出/挡出), deflected (轻微折射)
  goalkeeperPosition?: THREE.Vector3; // 守门员（碰撞点）的位置
  deflectionStrength?: number; // 如果是扑出，反弹的力量系数 (相对于原球速)
  deflectionAngleFactor?: number; // 如果是扑出，影响反弹角度的因素 (例如，0表示完美镜面反射，1表示随机性更大)
}
export class Goalkeeper {
  private scene: THREE.Scene;
  private goalLineZ: number;
  private group: THREE.Group;
  private torsoRadiusGK: number;
  private goalkeeperPositionAdjustedY: number;

  constructor(scene: THREE.Scene, goalLineZ: number) {
    this.scene = scene;
    this.goalLineZ = goalLineZ;
    this.group = new THREE.Group();
    this.createGoalkeeper();
    this.scene.add(this.group);
  }

  // private createGoalkeeper(): void {
  //   const gkMaterial = new THREE.MeshStandardMaterial({
  //     color: 0x4444ee,
  //     roughness: 0.6,
  //   });
  //   const gkSkinMaterial = new THREE.MeshStandardMaterial({
  //     color: 0xffaaaa,
  //     roughness: 0.5,
  //   });

  //   // 创建躯干
  //   const torsoHeightGK = 0.75 * (SIZES.GOALKEEPER_HEIGHT / 1.8);

  //   // 圆柱部分
  //   const cylinderGeomGK = new THREE.CylinderGeometry(
  //     this.torsoRadiusGK,
  //     this.torsoRadiusGK,
  //     torsoHeightGK,
  //     16
  //   );
  //   const cylinderGK = new THREE.Mesh(cylinderGeomGK, gkMaterial);
  //   cylinderGK.position.y = torsoHeightGK / 2 + this.torsoRadiusGK;
  //   cylinderGK.castShadow = true;
  //   this.group.add(cylinderGK);

  //   // 顶部半球
  //   const topSphereGeomGK = new THREE.SphereGeometry(
  //     this.torsoRadiusGK,
  //     16,
  //     8,
  //     0,
  //     Math.PI * 2,
  //     0,
  //     Math.PI / 2
  //   );
  //   const topSphereGK = new THREE.Mesh(topSphereGeomGK, gkMaterial);
  //   topSphereGK.position.y = cylinderGK.position.y + torsoHeightGK / 2;
  //   topSphereGK.castShadow = true;
  //   this.group.add(topSphereGK);

  //   // 底部半球
  //   const bottomSphereGeomGK = new THREE.SphereGeometry(
  //     this.torsoRadiusGK,
  //     16,
  //     8,
  //     0,
  //     Math.PI * 2,
  //     Math.PI / 2,
  //     Math.PI / 2
  //   );
  //   const bottomSphereGK = new THREE.Mesh(bottomSphereGeomGK, gkMaterial);
  //   bottomSphereGK.position.y = cylinderGK.position.y - torsoHeightGK / 2;
  //   bottomSphereGK.rotation.x = Math.PI;
  //   bottomSphereGK.castShadow = true;
  //   this.group.add(bottomSphereGK);

  //   // 头部
  //   const headGeomGK = new THREE.SphereGeometry(
  //     0.22 * (SIZES.GOALKEEPER_HEIGHT / 1.8),
  //     16,
  //     12
  //   );
  //   const headGK = new THREE.Mesh(headGeomGK, gkSkinMaterial);
  //   headGK.position.y =
  //     topSphereGK.position.y +
  //     this.torsoRadiusGK +
  //     0.05 * (SIZES.GOALKEEPER_HEIGHT / 1.8);
  //   headGK.castShadow = true;
  //   this.group.add(headGK);

  //   // 设置初始位置
  //   this.reset();
  // }

  private createGoalkeeper(): void {
    const gkMaterial = new THREE.MeshStandardMaterial({
      color: 0x4444ee,
      roughness: 0.6,
    });
    const gkSkinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffdbc9,
      roughness: 0.5,
    });
    const gloveMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
    }); // 手套材质
    const shortsMaterial = new THREE.MeshStandardMaterial({
      color: 0x3333dd,
      roughness: 0.6,
    }); // 短裤材质

    const totalHeight = SIZES.GOALKEEPER_HEIGHT; // 守门员总身高
    const headHeight = totalHeight / 7.5; // 假设身高是7.5个头高 (可以调整 7 到 8 之间)
    const headRadius = headHeight / 2;

    // 根据头高设定其他比例 (这些比例是近似值，需要微调以达到最佳视觉效果)
    const neckHeight = headHeight * 0.3;
    const neckRadius = headRadius * 0.6;

    // 躯干：通常躯干长度(不含颈)约为2.5-3个头高。宽度约为1.5-2个头宽(头直径)。
    // 这里我们用胶囊体，所以主要是高度和半径。
    // 假设躯干（圆柱+两半球）的总高度约为 totalHeight 的 1/3 到 2/5
    const torsoCapsuleTotalHeight = totalHeight * 0.38; // 躯干胶囊的总高度
    // 躯干半径可以基于头宽或者一个经验值
    this.torsoRadiusGK = headRadius * 1.3; // 躯干半径比头部半径稍大 (可调整)

    // 圆柱部分的高度 = 总胶囊高 - 2 * 半径 (因为上下是半球)
    const torsoCylinderHeight = Math.max(
      0.1,
      torsoCapsuleTotalHeight - 2 * this.torsoRadiusGK
    );

    // const shoulderWidth = headRadius * 2 * 1.8; // 肩宽约1.8倍头直径

    // 肢体 (长度基于总身高或头高比例)
    const upperArmLength = totalHeight * 0.18;
    const lowerArmLength = totalHeight * 0.17; // 下臂通常略短于上臂，或连手与上臂等长
    const armRadius = headRadius * 0.45; // 手臂粗细

    const upperLegLength = totalHeight * 0.25;
    const lowerLegLength = totalHeight * 0.23;
    const footHeight = totalHeight * 0.05; // 脚的高度 (如果做简单的脚)
    const legRadius = headRadius * 0.6; // 腿部粗细

    // --- 2. 创建各个部分 ---

    // 躯干的Y轴基准点 (使其底部大致在总身高的中点下方一点，为腿部留空间)
    // 胶囊体总高度的一半是其中心到两端的距离。
    // 我们希望整个守门员的Y轴中心大致在 totalHeight / 2
    // 躯干的脚底应该在0，所以躯干的中心点在 torsoCapsuleTotalHeight / 2
    const torsoCenterY = torsoCapsuleTotalHeight / 2;

    // 圆柱部分 (躯干主体)
    const cylinderGeomGK = new THREE.CylinderGeometry(
      this.torsoRadiusGK,
      this.torsoRadiusGK,
      torsoCylinderHeight,
      16
    );
    const cylinderGK = new THREE.Mesh(cylinderGeomGK, gkMaterial);
    // 圆柱的局部中心在 (0,0,0)，所以它的世界Y坐标就是躯干的中心Y
    cylinderGK.position.y = torsoCenterY;
    cylinderGK.castShadow = true;
    this.group.add(cylinderGK);

    // 顶部半球
    const topSphereGeomGK = new THREE.SphereGeometry(
      this.torsoRadiusGK,
      16,
      8,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );
    const topSphereGK = new THREE.Mesh(topSphereGeomGK, gkMaterial);
    topSphereGK.position.y = cylinderGK.position.y + torsoCylinderHeight / 2;
    topSphereGK.castShadow = true;
    this.group.add(topSphereGK);

    // 底部半球
    const bottomSphereGeomGK = new THREE.SphereGeometry(
      this.torsoRadiusGK,
      16,
      8,
      0,
      Math.PI * 2,
      Math.PI / 2,
      Math.PI / 2
    );
    const bottomSphereGK = new THREE.Mesh(bottomSphereGeomGK, gkMaterial);
    bottomSphereGK.position.y = cylinderGK.position.y - torsoCylinderHeight / 2;
    bottomSphereGK.castShadow = true;
    this.group.add(bottomSphereGK);

    // 颈部
    const neckGeom = new THREE.CylinderGeometry(
      neckRadius,
      neckRadius,
      neckHeight,
      8
    );
    const neck = new THREE.Mesh(neckGeom, gkSkinMaterial);
    // 颈部在顶部半球之上，半球的顶点是 cylinderGK.position.y + torsoCylinderHeight / 2 + this.torsoRadiusGK
    // 颈部中心应该在 (顶部半球顶点Y - 颈部高度/2)
    // 或者更简单：颈部底部与顶部半球的顶部相接
    neck.position.y =
      topSphereGK.position.y + this.torsoRadiusGK + neckHeight / 2;
    neck.castShadow = true;
    this.group.add(neck);

    // 头部
    const headGeomGK = new THREE.SphereGeometry(headRadius, 16, 12);
    const headGK = new THREE.Mesh(headGeomGK, gkSkinMaterial);
    headGK.position.y = neck.position.y + neckHeight / 2 + headRadius;
    headGK.castShadow = true;
    this.group.add(headGK);

    // --- 左肩和左臂 ---
    const leftShoulderPivot = new THREE.Group();

    // 1. 定位肩部枢轴
    //    这个位置应该是肩膀关节在守门员模型中的世界坐标（如果守门员group在原点）
    //    或者相对于守门员group的局部坐标。
    //    假设 torsoCenterY 是躯干几何中心的Y坐标。
    //    假设 this.torsoRadiusGK 是躯干半径。
    //    需要根据你的模型精确调整肩部枢轴的位置。
    const shoulderJointY = cylinderGK.position.y + torsoCylinderHeight * 0.4; // 大概在圆柱躯干的上部
    const shoulderJointX = this.torsoRadiusGK + armRadius * 0.2; // 稍微偏出躯干一点
    leftShoulderPivot.position.set(shoulderJointX, shoulderJointY, 0); // Z=0 或根据需要调整
    this.group.add(leftShoulderPivot); // 将肩部枢轴添加到守门员的主group

    // 创建上臂网格
    const upperArmGeom = new THREE.CylinderGeometry(
      armRadius,
      armRadius * 0.9,
      upperArmLength,
      8
    );
    const leftUpperArmMesh = new THREE.Mesh(upperArmGeom, gkMaterial); // gkMaterial 是球衣材质
    leftUpperArmMesh.castShadow = true;

    // 2. 调整上臂相对于肩部枢轴的局部位置
    //    我们希望上臂从枢轴点向下延伸。
    //    圆柱体的几何中心在其中点，所以我们需要将其向下移动 L/2。
    leftUpperArmMesh.position.y = -upperArmLength / 2;
    // (可选) 可以在这里给上臂一个初始的微小旋转，如果希望它不是完全垂直于枢轴的某个面
    // leftUpperArmMesh.rotation.x = Math.PI / 18; // 例如，稍微向前倾斜一点

    // 3. 将上臂添加到肩部枢轴
    leftShoulderPivot.add(leftUpperArmMesh);

    // (可选) 如果有肘部和下臂，也用类似的方法
    const leftElbowPivot = new THREE.Group();
    // 肘部枢轴的位置是上臂的末端 (相对于上臂的局部坐标)
    leftElbowPivot.position.y = -upperArmLength / 2; // (因为上臂的中心在-L/2,所以末端是-L) - 这个逻辑要小心
    // 更准确的是：elbowPivot.position.y = -upperArmLength; (如果上臂原点在枢轴)
    // 或者，如果上臂的position.y已经是-upperArmLength/2,
    // 那么肘部枢轴相对于上臂的局部原点是在 (0, -upperArmLength/2, 0)
    leftUpperArmMesh.add(leftElbowPivot); // 将肘部枢轴作为上臂的子对象

    const lowerArmGeom = new THREE.CylinderGeometry(
      armRadius * 0.9,
      armRadius * 0.75,
      lowerArmLength,
      8
    );
    const leftLowerArmMesh = new THREE.Mesh(lowerArmGeom, gkSkinMaterial);
    leftLowerArmMesh.castShadow = true;
    leftLowerArmMesh.position.y = -lowerArmLength / 2; // 下臂从肘部枢轴向下延伸
    leftElbowPivot.add(leftLowerArmMesh);

    // (可选) 手部可以作为下臂的子对象，或连接到手腕枢轴
    const handMesh = new THREE.Mesh(
      new THREE.SphereGeometry(armRadius * 1.2, 8, 6),
      gloveMaterial
    );
    handMesh.castShadow = true;
    handMesh.position.y = -lowerArmLength / 2; // 手在下臂末端
    leftLowerArmMesh.add(handMesh);
    leftShoulderPivot.rotation.z = Math.PI / 3; // 左肩稍微向前倾斜 (可选)
    leftElbowPivot.rotation.z = Math.PI / 12; // 左肘稍微弯曲 (可选)

    // 右臂和右手 (克隆并对称)
    const rightShoulderPivot = new THREE.Group();
    rightShoulderPivot.position.set(-shoulderJointX, shoulderJointY, 0); // Z=0 或根据需要调整
    this.group.add(rightShoulderPivot);

    const rightUpperArmMesh = new THREE.Mesh(upperArmGeom, gkMaterial);
    rightUpperArmMesh.position.y = -upperArmLength / 2;
    rightShoulderPivot.add(rightUpperArmMesh);

    const rightElbowPivot = new THREE.Group();
    rightElbowPivot.position.y = -upperArmLength / 2;
    rightUpperArmMesh.add(rightElbowPivot);

    const rightLowerArmMesh = new THREE.Mesh(lowerArmGeom, gkSkinMaterial);
    rightLowerArmMesh.position.y = -lowerArmLength / 2;
    rightElbowPivot.add(rightLowerArmMesh);

    const rightHandMesh = handMesh.clone();
    rightHandMesh.position.y = -lowerArmLength / 2;
    rightLowerArmMesh.add(rightHandMesh);
    rightShoulderPivot.rotation.z = -Math.PI / 3; // 右肩稍微向后倾斜
    rightElbowPivot.rotation.z = -Math.PI / 12; // 右肘稍微弯曲

    // --- 腿部和脚 (示例 - 短裤已覆盖大腿上部) ---
    // 假设短裤/大腿部分从躯干底部开始
    const hipCenterY = bottomSphereGK.position.y - this.torsoRadiusGK; // 臀部/大腿开始的Y

    // 左大腿 (被短裤材质覆盖)
    const leftUpperLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(
        legRadius,
        legRadius * 0.9,
        upperLegLength,
        10
      ),
      shortsMaterial
    );
    leftUpperLeg.castShadow = true;
    const hipXOffset = this.torsoRadiusGK * 0.5; // 两腿分开的距离
    leftUpperLeg.position.set(-hipXOffset, hipCenterY - upperLegLength / 2, 0);
    this.group.add(leftUpperLeg);

    // 左小腿
    const leftLowerLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(
        legRadius * 0.9,
        legRadius * 0.7,
        lowerLegLength,
        10
      ),
      gkSkinMaterial // 假设小腿是皮肤或球袜
    );
    leftLowerLeg.castShadow = true;
    const kneePosition = new THREE.Vector3(0, -upperLegLength / 2, 0).add(
      leftUpperLeg.position
    );
    leftLowerLeg.position
      .copy(kneePosition)
      .add(new THREE.Vector3(0, -lowerLegLength / 2, 0));
    this.group.add(leftLowerLeg);

    // 左脚 (简单立方体)
    const leftFoot = new THREE.Mesh(
      new THREE.BoxGeometry(legRadius * 1.5, footHeight, legRadius * 2.2), // 宽，高，长
      gloveMaterial // 假设是球鞋颜色
    );
    leftFoot.castShadow = true;
    const anklePosition = new THREE.Vector3(0, -lowerLegLength / 2, 0).add(
      leftLowerLeg.position
    );
    leftFoot.position
      .copy(anklePosition)
      .setY(anklePosition.y - footHeight / 2 + 0.01); // 脚底贴近0
    leftFoot.position.z += legRadius * 0.5; // 脚向前伸一点
    this.group.add(leftFoot);

    // 右腿和右脚 (克隆并对称)
    // ... 实现右腿的克隆和定位 ...
    // 右大腿
    const rightUpperLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(
        legRadius,
        legRadius * 0.9,
        upperLegLength,
        10
      ),
      shortsMaterial
    );
    rightUpperLeg.castShadow = true;
    rightUpperLeg.position.set(hipXOffset, hipCenterY - upperLegLength / 2, 0);
    this.group.add(rightUpperLeg);

    // 右小腿
    const rightLowerLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(
        legRadius * 0.9,
        legRadius * 0.7,
        lowerLegLength,
        10
      ),
      gkSkinMaterial
    );
    rightLowerLeg.castShadow = true;
    const rightKneePosition = new THREE.Vector3(0, -upperLegLength / 2, 0).add(
      rightUpperLeg.position
    );
    rightLowerLeg.position
      .copy(rightKneePosition)
      .add(new THREE.Vector3(0, -lowerLegLength / 2, 0));
    this.group.add(rightLowerLeg);

    // 右脚
    const rightFoot = new THREE.Mesh(
      new THREE.BoxGeometry(legRadius * 1.5, footHeight, legRadius * 2.2),
      gloveMaterial
    );
    rightFoot.castShadow = true;
    const rightAnklePosition = new THREE.Vector3(0, -lowerLegLength / 2, 0).add(
      rightLowerLeg.position
    );
    rightFoot.position
      .copy(rightAnklePosition)
      .setY(rightAnklePosition.y - footHeight / 2 + 0.01);
    rightFoot.position.z += legRadius * 0.5;
    this.group.add(rightFoot);

    // --- 调整整个group的Y位置，使得脚底大致在Y=0 ---
    // 计算最低点 (例如左脚的底部)
    this.goalkeeperPositionAdjustedY = footHeight / 2 - leftFoot.position.y;
    this.group.position.y = this.goalkeeperPositionAdjustedY; // 将整个group向上移动，使得脚底为0

    this.reset();
  }

  public reset(): void {
    this.group.position.set(
      0,
      this.goalkeeperPositionAdjustedY,
      this.goalLineZ - Math.sign(this.goalLineZ) * 0.8
    );
    this.group.lookAt(new THREE.Vector3(0, SIZES.GOALKEEPER_HEIGHT / 2, 0));
  }

  public update(
    ballPosition: THREE.Vector3,
    ballVelocity: THREE.Vector3
  ): void {
    if (ballVelocity.lengthSq() < 0.001) {
      // 球静止时，守门员做待机动作
      const idleMove =
        Math.sin(performance.now() * 0.0005) * (FIELD.GOAL_WIDTH * 0.15);
      this.group.position.x = THREE.MathUtils.clamp(
        idleMove,
        -FIELD.GOAL_WIDTH / 2 + 2,
        FIELD.GOAL_WIDTH / 2 - 2
      );
    } else if (
      Math.abs(ballPosition.z - this.group.position.z) < 5 &&
      ballPosition.y < SIZES.GOALKEEPER_HEIGHT * 1.2
    ) {
      // 球在守门员附近且不高时，进行扑救
      const targetX = THREE.MathUtils.clamp(
        ballPosition.x,
        -FIELD.GOAL_WIDTH / 2 + this.torsoRadiusGK,
        FIELD.GOAL_WIDTH / 2 - this.torsoRadiusGK
      );
      this.group.position.x +=
        (targetX - this.group.position.x) * CONTROLS.GK_AGILITY;
    }
  }

  public checkSave(
    ballPosition: THREE.Vector3,
    ballVelocity: THREE.Vector3
  ): DetailedSaveResult {
    const gkMassPosition = this.group.position.clone();
    const diveReach = SIZES.GOALKEEPER_HEIGHT * 0.5; // 基本扑救范围
    const distanceToCenterOfMass = ballPosition.distanceTo(gkMassPosition); // 球与守门员重心的距离
    const distanceToCenterOfMassOnXY =
      (ballPosition.x - gkMassPosition.x) ** 2 +
      (ballPosition.y - gkMassPosition.y) ** 2; // 球与守门员重心的距离（忽略Z轴）

    if (distanceToCenterOfMass < diveReach) {
      // ---- 判定扑救类型 ----
      const ballSpeed = ballVelocity.length();
      let saveType: "caught" | "parried" = "parried"; // 默认是扑出
      let deflectionStrength = PHYSICS.RESTITUTION_COEFFICIENT; // 默认反弹系数

      const CATCH_ON_TARGET_SPEED_THRESHOLD = 60;
      const CATCH_OTHER_SPEED_THRESHOLD = 10;

      // 模拟守门员的 "甜点区"
      const CATCH_SWEET_SPOT_RADIUS = diveReach * 0.4;
      if (
        (ballSpeed < CATCH_ON_TARGET_SPEED_THRESHOLD &&
          distanceToCenterOfMassOnXY < CATCH_SWEET_SPOT_RADIUS ** 2) ||
        (ballSpeed < CATCH_OTHER_SPEED_THRESHOLD &&
          distanceToCenterOfMassOnXY < diveReach ** 2)
      ) {
        // 更有可能抱住球
        // 可以加入更多条件，比如球的Y坐标是否在胸部附近
        if (
          ballPosition.y > SIZES.BALL_RADIUS &&
          ballPosition.y < SIZES.GOALKEEPER_HEIGHT * 0.8
        ) {
          // 球在合适的抱球高度
          // 引入随机性
          if (Math.random() < 0.75) {
            // 75% 概率抱住
            saveType = "caught";
          }
        }
      }

      // 条件2: 极端扑救或高速球
      if (saveType === "parried") {
        // 如果前面没判定为抱住
        if (
          distanceToCenterOfMass > diveReach * 0.7 ||
          ballSpeed > CONTROLS.MAX_POWER * 0.6
        ) {
          // 极限扑救或球速非常快，反弹系数可能更高（球更硬）或者方向更不可控
          deflectionStrength = PHYSICS.RESTITUTION_COEFFICIENT * 1.1; // 稍微增加反弹
        }
      }

      return {
        saved: true,
        saveType: saveType,
        goalkeeperPosition: gkMassPosition,
        deflectionStrength: deflectionStrength,
        deflectionAngleFactor: saveType === "parried" ? Math.random() * 0.3 : 0, // 扑出时增加一点角度随机性
      };
    }
    return { saved: false };
  }
}
