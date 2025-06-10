import * as THREE from "three";
import { FIELD } from "@/stores/constants";

export class Field {
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public createField(): void {
    // 创建草地
    this.createGrass();
    // 创建球场线条
    this.createLines();
    // 创建球门区域
    this.createGoalAreas();
  }

  private createGrass(): void {
    const grassColor1 = new THREE.Color(0x2e7d32);
    const grassColor2 = new THREE.Color(0x4caf50);
    const stripeHeight = 7;
    const numStripes = Math.ceil(FIELD.LENGTH / stripeHeight);

    const grassStripeGroup = new THREE.Group();
    grassStripeGroup.name = "grassStripeGroup";

    for (let i = 0; i < numStripes; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? grassColor1 : grassColor2,
        roughness: 0.9,
        metalness: 0.05,
      });
      const stripeGeometry = new THREE.PlaneGeometry(FIELD.WIDTH, stripeHeight);
      const stripe = new THREE.Mesh(stripeGeometry, material);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.z =
        -FIELD.LENGTH / 2 + stripeHeight / 2 + i * stripeHeight;
      stripe.position.y = 0;
      stripe.receiveShadow = true;
      grassStripeGroup.add(stripe);
    }
    this.scene.add(grassStripeGroup);

    // 球场外围
    const surroundingGroundMat = new THREE.MeshStandardMaterial({
      color: 0x4a5d23,
      roughness: 1,
    });
    const surroundingGroundGeom = new THREE.PlaneGeometry(
      FIELD.WIDTH + 80,
      FIELD.LENGTH + 80
    );
    const surroundingGround = new THREE.Mesh(
      surroundingGroundGeom,
      surroundingGroundMat
    );
    surroundingGround.rotation.x = -Math.PI / 2;
    surroundingGround.position.y = -0.02;
    surroundingGround.receiveShadow = true;
    this.scene.add(surroundingGround);
  }

  private createLines(): void {
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 3,
    });

    // 边界线
    const boundaryPoints = [
      new THREE.Vector3(-FIELD.WIDTH / 2, 0.01, -FIELD.LENGTH / 2),
      new THREE.Vector3(FIELD.WIDTH / 2, 0.01, -FIELD.LENGTH / 2),
      new THREE.Vector3(FIELD.WIDTH / 2, 0.01, FIELD.LENGTH / 2),
      new THREE.Vector3(-FIELD.WIDTH / 2, 0.01, FIELD.LENGTH / 2),
      new THREE.Vector3(-FIELD.WIDTH / 2, 0.01, -FIELD.LENGTH / 2),
    ];
    this.scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(boundaryPoints),
        lineMaterial
      )
    );

    // 中线
    this.scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-FIELD.WIDTH / 2, 0.01, 0),
          new THREE.Vector3(FIELD.WIDTH / 2, 0.01, 0),
        ]),
        lineMaterial
      )
    );

    // 中圈
    const centerCircleGeom = new THREE.CircleGeometry(
      FIELD.CENTER_CIRCLE_RADIUS,
      64
    );
    const centerCircle = new THREE.LineSegments(
      new THREE.EdgesGeometry(centerCircleGeom),
      lineMaterial
    );
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.y = 0.01;
    this.scene.add(centerCircle);
  }

  private createGoalAreas(): void {
    this.createGoalArea(-FIELD.LENGTH / 2);
    this.createGoalArea(FIELD.LENGTH / 2);
  }

  private createGoalArea(goalLineZ: number): void {
    const sideSign = Math.sign(goalLineZ);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 3,
    });

    // 禁区
    const paPoints = [
      new THREE.Vector3(-FIELD.PENALTY_AREA_WIDTH / 2, 0.01, goalLineZ),
      new THREE.Vector3(FIELD.PENALTY_AREA_WIDTH / 2, 0.01, goalLineZ),
      new THREE.Vector3(
        FIELD.PENALTY_AREA_WIDTH / 2,
        0.01,
        goalLineZ - sideSign * FIELD.PENALTY_AREA_DEPTH
      ),
      new THREE.Vector3(
        -FIELD.PENALTY_AREA_WIDTH / 2,
        0.01,
        goalLineZ - sideSign * FIELD.PENALTY_AREA_DEPTH
      ),
      new THREE.Vector3(-FIELD.PENALTY_AREA_WIDTH / 2, 0.01, goalLineZ),
    ];
    this.scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(paPoints),
        lineMaterial
      )
    );

    // 小禁区
    const gaPoints = [
      new THREE.Vector3(-FIELD.GOAL_AREA_WIDTH / 2, 0.01, goalLineZ),
      new THREE.Vector3(FIELD.GOAL_AREA_WIDTH / 2, 0.01, goalLineZ),
      new THREE.Vector3(
        FIELD.GOAL_AREA_WIDTH / 2,
        0.01,
        goalLineZ - sideSign * FIELD.GOAL_AREA_DEPTH
      ),
      new THREE.Vector3(
        -FIELD.GOAL_AREA_WIDTH / 2,
        0.01,
        goalLineZ - sideSign * FIELD.GOAL_AREA_DEPTH
      ),
      new THREE.Vector3(-FIELD.GOAL_AREA_WIDTH / 2, 0.01, goalLineZ),
    ];
    this.scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(gaPoints),
        lineMaterial
      )
    );

    // 罚球点
    const penaltySpotZ = goalLineZ - sideSign * FIELD.PENALTY_SPOT_DISTANCE;
    const spotGeom = new THREE.CircleGeometry(0.15, 16);
    const spot = new THREE.Mesh(
      spotGeom,
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    spot.position.set(0, 0.015, penaltySpotZ);
    spot.rotation.x = -Math.PI / 2;
    this.scene.add(spot);

    // 罚球弧
    this.createPenaltyArc(penaltySpotZ, sideSign);

    // 球门
    this.createGoal(goalLineZ);
  }

  private createPenaltyArc(penaltySpotZ: number, sideSign: number): void {
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 3, // Consider Line2 for thicker lines
    });
    const arcPoints: THREE.Vector3[] = [];
    const arcRadius = FIELD.CENTER_CIRCLE_RADIUS; // R
    const numSegments = 32;

    const zCutRelative =
      (FIELD.PENALTY_AREA_DEPTH - FIELD.PENALTY_SPOT_DISTANCE) * -sideSign;

    if (Math.abs(zCutRelative) >= arcRadius) {
      console.warn(
        "Penalty arc cut line is outside the arc radius. No arc to draw."
      );
      return;
    }

    // 计算交点的 x 坐标
    // x² + z_cut² = R²  => x² = R² - z_cut²
    const xIntersectSquared =
      arcRadius * arcRadius - zCutRelative * zCutRelative;
    if (xIntersectSquared < 0) {
      // 理论上不应该发生，因为上面已经检查了 abs(zCutRelative) < arcRadius
      console.warn("Cannot calculate intersection points for penalty arc.");
      return;
    }
    const xIntersect = Math.sqrt(xIntersectSquared);

    // 交点坐标 (相对于罚球点)
    const intersectPoint1 = new THREE.Vector2(-xIntersect, zCutRelative); // 左交点
    const intersectPoint2 = new THREE.Vector2(xIntersect, zCutRelative); // 右交点

    let angleStart: number;
    let angleEnd: number;

    if (sideSign < 0) {
      // 上半场，罚球弧在 Z > 0 的部分
      angleStart = Math.atan2(intersectPoint2.y, intersectPoint2.x); // 右交点角度 (较小)
      angleEnd = Math.atan2(intersectPoint1.y, intersectPoint1.x); // 左交点角度 (较大)
    } else {
      angleStart = Math.atan2(intersectPoint2.y, intersectPoint2.x); // 右交点角度 (如 ~-30度 或 330度)
      angleEnd = Math.atan2(intersectPoint1.y, intersectPoint1.x); // 左交点角度 (如 ~-150度 或 210度)

      if (angleEnd < angleStart) {
        const alpha = Math.atan2(zCutRelative, xIntersect);

        if (sideSign < 0) {
          // Top arc, zCutRelative > 0
          angleStart = alpha; // Angle of (xIntersect, zCutRelative)
          angleEnd = Math.PI - alpha; // Angle of (-xIntersect, zCutRelative)
        } else {
          angleStart = alpha;
          const alpha_abs_z = Math.atan2(Math.abs(zCutRelative), xIntersect); // angle for (+x, +|z_cut|)
          angleStart = -alpha_abs_z;
          angleEnd = -(Math.PI - alpha_abs_z);
        }
      }
    }

    if (sideSign < 0) {
      // Top arc
      angleStart = Math.atan2(zCutRelative, xIntersect); // Q1
      angleEnd = Math.atan2(zCutRelative, -xIntersect); // Q2
    } else {
      // Bottom arc
      angleStart = Math.atan2(zCutRelative, xIntersect); // Q4 (e.g. -0.5 rad)
      angleEnd = Math.atan2(zCutRelative, -xIntersect); // Q3 (e.g. -2.6 rad)
    }

    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const angle = angleStart + t * (angleEnd - angleStart);

      const x = arcRadius * Math.cos(angle);
      const z = arcRadius * Math.sin(angle); // This z is relative to penalty spot

      arcPoints.push(new THREE.Vector3(x, 0.01, penaltySpotZ + z));
    }

    if (arcPoints.length > 1) {
      this.scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(arcPoints),
          lineMaterial
        )
      );
    }
  }

  private createGoal(goalLineZ: number): void {
    const postMaterial = new THREE.MeshStandardMaterial({
      color: 0xe0e0e0,
      roughness: 0.2,
      metalness: 0.8,
    });
    const postGeo = new THREE.CylinderGeometry(
      FIELD.POST_RADIUS,
      FIELD.POST_RADIUS,
      FIELD.GOAL_HEIGHT,
      16
    );

    // 左门柱
    const leftPost = new THREE.Mesh(postGeo, postMaterial);
    leftPost.position.set(
      -FIELD.GOAL_WIDTH / 2,
      FIELD.GOAL_HEIGHT / 2,
      goalLineZ
    );
    leftPost.castShadow = true;
    this.scene.add(leftPost);

    // 右门柱
    const rightPost = new THREE.Mesh(postGeo, postMaterial);
    rightPost.position.set(
      FIELD.GOAL_WIDTH / 2,
      FIELD.GOAL_HEIGHT / 2,
      goalLineZ
    );
    rightPost.castShadow = true;
    this.scene.add(rightPost);

    // 横梁
    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(
        FIELD.POST_RADIUS,
        FIELD.POST_RADIUS,
        FIELD.GOAL_WIDTH + 2 * FIELD.POST_RADIUS,
        16
      ),
      postMaterial
    );
    crossbar.position.set(0, FIELD.GOAL_HEIGHT, goalLineZ);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.castShadow = true;
    this.scene.add(crossbar);

    // 球网
    this.createNet(goalLineZ);
  }

  private createSubdividedNetFace(
    v1Name: string, // 四边形的第一个角点名称 (例如，左下)
    v2Name: string, // 第二个角点 (例如，右下)
    v3Name: string, // 第三个角点 (例如，右上)
    v4Name: string, // 第四个角点 (例如，左上)
    segmentsU: number, // U方向 (v1-v2 / v4-v3 方向) 的细分段数
    segmentsV: number, // V方向 (v1-v4 / v2-v3 方向) 的细分段数
    allVertices: { [key: string]: THREE.Vector3 }, // 包含所有主要顶点的对象
    material: THREE.Material // 球网材质
  ): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    const vertices_coords: number[] = []; // 存储所有细分后的顶点坐标 (x,y,z,x,y,z,...)
    const indices: number[] = []; // 存储构成三角形的顶点索引

    const v1 = allVertices[v1Name];
    const v2 = allVertices[v2Name];
    const v3 = allVertices[v3Name];
    const v4 = allVertices[v4Name];

    // 生成所有细分顶点
    for (let j = 0; j <= segmentsV; j++) {
      // 遍历V方向的每一行
      const tV = j / segmentsV; // 当前行在V方向的插值比例 (0 到 1)

      // 计算当前V行上的左右两个基准点
      // 左基准点: v1 和 v4 之间的插值
      const leftEdgePoint = new THREE.Vector3().lerpVectors(v1, v4, tV);
      // 右基准点: v2 和 v3 之间的插值
      const rightEdgePoint = new THREE.Vector3().lerpVectors(v2, v3, tV);

      for (let i = 0; i <= segmentsU; i++) {
        // 遍历U方向的每一列
        const tU = i / segmentsU; // 当前列在U方向的插值比例 (0 到 1)

        // 在左右基准点之间插值得到当前顶点
        const point = new THREE.Vector3().lerpVectors(
          leftEdgePoint,
          rightEdgePoint,
          tU
        );
        vertices_coords.push(point.x, point.y, point.z);
      }
    }

    // 生成索引来构建三角形面片
    // (segmentsU + 1) 是U方向的顶点数 (因为 segmentsU 是段数)
    for (let j = 0; j < segmentsV; j++) {
      // 遍历V方向的行 (不包括最后一行顶点)
      for (let i = 0; i < segmentsU; i++) {
        // 遍历U方向的列 (不包括最后一列顶点)
        // 计算组成一个小四边形的四个顶点的索引
        const a = j * (segmentsU + 1) + i; // 当前格子左下角
        const b = j * (segmentsU + 1) + (i + 1); // 当前格子右下角
        const c = (j + 1) * (segmentsU + 1) + (i + 1); // 当前格子右上角
        const d = (j + 1) * (segmentsU + 1) + i; // 当前格子左上角

        // 用这两个索引起组创建两个三角形来填充这个小四边形
        // 三角形1: (a, b, d)
        indices.push(a, b, d);
        // 三角形2: (b, c, d)
        indices.push(b, c, d);
      }
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices_coords, 3)
    );
    geometry.setIndex(indices); // 设置顶点索引
    geometry.computeVertexNormals(); // 计算法线（对于线框材质可能不是必须，但好习惯）

    return new THREE.Mesh(geometry, material);
  }

  private createNet(goalLineZ: number): void {
    const netMaterial = new THREE.MeshBasicMaterial({
      color: 0xdddddd,
      wireframe: true,
      opacity: 0.5,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const sideSign = Math.sign(goalLineZ);
    const netShapeDepth = FIELD.GOAL_DEPTH * 0.5;
    const netBottomDepth = FIELD.GOAL_DEPTH;

    // 顶点定义保持不变
    const verticesData: { [key: string]: THREE.Vector3 } = {
      ftl: new THREE.Vector3(-FIELD.GOAL_WIDTH / 2, FIELD.GOAL_HEIGHT, 0),
      ftr: new THREE.Vector3(FIELD.GOAL_WIDTH / 2, FIELD.GOAL_HEIGHT, 0),
      fbl: new THREE.Vector3(-FIELD.GOAL_WIDTH / 2, 0, 0),
      fbr: new THREE.Vector3(FIELD.GOAL_WIDTH / 2, 0, 0),
      btl: new THREE.Vector3(
        (-FIELD.GOAL_WIDTH / 2) * 0.95,
        FIELD.GOAL_HEIGHT - FIELD.GOAL_DEPTH * 0.1,
        sideSign * netShapeDepth
      ),
      btr: new THREE.Vector3(
        (FIELD.GOAL_WIDTH / 2) * 0.95,
        FIELD.GOAL_HEIGHT - FIELD.GOAL_DEPTH * 0.1,
        sideSign * netShapeDepth
      ),
      bbl: new THREE.Vector3(
        -FIELD.GOAL_WIDTH / 2,
        0,
        sideSign * netBottomDepth
      ),
      bbr: new THREE.Vector3(
        FIELD.GOAL_WIDTH / 2,
        0,
        sideSign * netBottomDepth
      ),
    };

    for (const key in verticesData) {
      verticesData[key].z += goalLineZ;
    }

    // 定义细分程度
    const X_SEGMENTS = 16; // 水平方向细分数，例如宽度方向
    const Y_SEGMENTS = 6; // 垂直方向细分数，例如高度方向
    const Z_SEGMENTS = 6; // 深度方向细分数 (如果需要)

    // 后网面
    this.scene.add(
      this.createSubdividedNetFace(
        "bbl",
        "bbr",
        "btr",
        "btl",
        X_SEGMENTS,
        Y_SEGMENTS, // 可以调整后网的细分
        verticesData,
        netMaterial
      )
    );

    // 左侧网面 (从球门外向内看球门左侧)
    // v1=fbl(前下), v2=bbl(后下), v3=btl(后上), v4=ftl(前上)
    this.scene.add(
      this.createSubdividedNetFace(
        "fbl",
        "bbl",
        "btl",
        "ftl",
        Z_SEGMENTS,
        Y_SEGMENTS,
        verticesData,
        netMaterial
      )
    );

    this.scene.add(
      this.createSubdividedNetFace(
        "fbr",
        "bbr",
        "btr",
        "ftr", // 保持顺序 fbr -> bbr -> btr -> ftr
        Z_SEGMENTS,
        Y_SEGMENTS,
        verticesData,
        netMaterial
      )
    );

    this.scene.add(
      this.createSubdividedNetFace(
        "ftl",
        "ftr",
        "btr",
        "btl",
        X_SEGMENTS,
        Z_SEGMENTS, // 顶网的U,V可能都代表平面上的方向
        verticesData,
        netMaterial
      )
    );
  }
}
