import * as THREE from "three";
import { FIELD } from '@/stores/constants';

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
        const grassColor1 = new THREE.Color(0x2E7D32);
        const grassColor2 = new THREE.Color(0x4CAF50);
        const stripeHeight = 7;
        const numStripes = Math.ceil(FIELD.LENGTH / stripeHeight);

        const grassStripeGroup = new THREE.Group();
        grassStripeGroup.name = 'grassStripeGroup';

        for (let i = 0; i < numStripes; i++) {
            const material = new THREE.MeshStandardMaterial({
                color: (i % 2 === 0) ? grassColor1 : grassColor2,
                roughness: 0.9,
                metalness: 0.05
            });
            const stripeGeometry = new THREE.PlaneGeometry(FIELD.WIDTH, stripeHeight);
            const stripe = new THREE.Mesh(stripeGeometry, material);
            stripe.rotation.x = -Math.PI / 2;
            stripe.position.z = -FIELD.LENGTH / 2 + stripeHeight / 2 + i * stripeHeight;
            stripe.position.y = 0;
            stripe.receiveShadow = true;
            grassStripeGroup.add(stripe);
        }
        this.scene.add(grassStripeGroup);

        // 球场外围
        const surroundingGroundMat = new THREE.MeshStandardMaterial({ 
            color: 0x4A5D23, 
            roughness: 1 
        });
        const surroundingGroundGeom = new THREE.PlaneGeometry(
            FIELD.WIDTH + 80, 
            FIELD.LENGTH + 80
        );
        const surroundingGround = new THREE.Mesh(surroundingGroundGeom, surroundingGroundMat);
        surroundingGround.rotation.x = -Math.PI / 2;
        surroundingGround.position.y = -0.02;
        surroundingGround.receiveShadow = true;
        this.scene.add(surroundingGround);
    }

    private createLines(): void {
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff, 
            linewidth: 3 
        });

        // 边界线
        const boundaryPoints = [
            new THREE.Vector3(-FIELD.WIDTH / 2, 0.01, -FIELD.LENGTH / 2),
            new THREE.Vector3(FIELD.WIDTH / 2, 0.01, -FIELD.LENGTH / 2),
            new THREE.Vector3(FIELD.WIDTH / 2, 0.01, FIELD.LENGTH / 2),
            new THREE.Vector3(-FIELD.WIDTH / 2, 0.01, FIELD.LENGTH / 2),
            new THREE.Vector3(-FIELD.WIDTH / 2, 0.01, -FIELD.LENGTH / 2)
        ];
        this.scene.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(boundaryPoints), 
            lineMaterial
        ));

        // 中线
        this.scene.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-FIELD.WIDTH / 2, 0.01, 0),
                new THREE.Vector3(FIELD.WIDTH / 2, 0.01, 0)
            ]),
            lineMaterial
        ));

        // 中圈
        const centerCircleGeom = new THREE.CircleGeometry(FIELD.CENTER_CIRCLE_RADIUS, 64);
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
            linewidth: 3 
        });

        // 禁区
        const paPoints = [
            new THREE.Vector3(-FIELD.PENALTY_AREA_WIDTH / 2, 0.01, goalLineZ),
            new THREE.Vector3(FIELD.PENALTY_AREA_WIDTH / 2, 0.01, goalLineZ),
            new THREE.Vector3(FIELD.PENALTY_AREA_WIDTH / 2, 0.01, goalLineZ - sideSign * FIELD.PENALTY_AREA_DEPTH),
            new THREE.Vector3(-FIELD.PENALTY_AREA_WIDTH / 2, 0.01, goalLineZ - sideSign * FIELD.PENALTY_AREA_DEPTH),
            new THREE.Vector3(-FIELD.PENALTY_AREA_WIDTH / 2, 0.01, goalLineZ)
        ];
        this.scene.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(paPoints),
            lineMaterial
        ));

        // 小禁区
        const gaPoints = [
            new THREE.Vector3(-FIELD.GOAL_AREA_WIDTH / 2, 0.01, goalLineZ),
            new THREE.Vector3(FIELD.GOAL_AREA_WIDTH / 2, 0.01, goalLineZ),
            new THREE.Vector3(FIELD.GOAL_AREA_WIDTH / 2, 0.01, goalLineZ - sideSign * FIELD.GOAL_AREA_DEPTH),
            new THREE.Vector3(-FIELD.GOAL_AREA_WIDTH / 2, 0.01, goalLineZ - sideSign * FIELD.GOAL_AREA_DEPTH),
            new THREE.Vector3(-FIELD.GOAL_AREA_WIDTH / 2, 0.01, goalLineZ)
        ];
        this.scene.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(gaPoints),
            lineMaterial
        ));

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
        linewidth: 3 // Consider Line2 for thicker lines
    });
    const arcPoints: THREE.Vector3[] = [];
    const arcRadius = FIELD.CENTER_CIRCLE_RADIUS; // R
    const numSegments = 32;

    const zCutRelative = (FIELD.PENALTY_AREA_DEPTH - FIELD.PENALTY_SPOT_DISTANCE) * -sideSign;
    
    if (Math.abs(zCutRelative) >= arcRadius) {
        console.warn("Penalty arc cut line is outside the arc radius. No arc to draw.");
        return;
    }

    // 计算交点的 x 坐标
    // x² + z_cut² = R²  => x² = R² - z_cut²
    const xIntersectSquared = arcRadius * arcRadius - zCutRelative * zCutRelative;
    if (xIntersectSquared < 0) { // 理论上不应该发生，因为上面已经检查了 abs(zCutRelative) < arcRadius
        console.warn("Cannot calculate intersection points for penalty arc.");
        return;
    }
    const xIntersect = Math.sqrt(xIntersectSquared);

    // 交点坐标 (相对于罚球点)
    const intersectPoint1 = new THREE.Vector2(-xIntersect, zCutRelative); // 左交点
    const intersectPoint2 = new THREE.Vector2(xIntersect, zCutRelative);  // 右交点

    let angleStart: number;
    let angleEnd: number;

    if (sideSign < 0) { // 上半场，罚球弧在 Z > 0 的部分
        angleStart = Math.atan2(intersectPoint2.y, intersectPoint2.x); // 右交点角度 (较小)
        angleEnd = Math.atan2(intersectPoint1.y, intersectPoint1.x);   // 左交点角度 (较大)
    } else { 
        angleStart = Math.atan2(intersectPoint2.y, intersectPoint2.x); // 右交点角度 (如 ~-30度 或 330度)
        angleEnd = Math.atan2(intersectPoint1.y, intersectPoint1.x);   // 左交点角度 (如 ~-150度 或 210度)

        if (angleEnd < angleStart) {
             
             const alpha = Math.atan2(zCutRelative, xIntersect); 

             if (sideSign < 0) { // Top arc, zCutRelative > 0
                 angleStart = alpha;         // Angle of (xIntersect, zCutRelative)
                 angleEnd = Math.PI - alpha; // Angle of (-xIntersect, zCutRelative)
             } else { 
                 angleStart = alpha; 
                 const alpha_abs_z = Math.atan2(Math.abs(zCutRelative), xIntersect); // angle for (+x, +|z_cut|)
                 angleStart = -alpha_abs_z;
                 angleEnd = -(Math.PI - alpha_abs_z);
             }
        }
    }

    if (sideSign < 0) { // Top arc
        angleStart = Math.atan2(zCutRelative, xIntersect);    // Q1
        angleEnd = Math.atan2(zCutRelative, -xIntersect);   // Q2
    } else { // Bottom arc
        angleStart = Math.atan2(zCutRelative, xIntersect);    // Q4 (e.g. -0.5 rad)
        angleEnd = Math.atan2(zCutRelative, -xIntersect);   // Q3 (e.g. -2.6 rad)
    }


    for (let i = 0; i <= numSegments; i++) {
        const t = i / numSegments;
        const angle = angleStart + t * (angleEnd - angleStart);

        const x = arcRadius * Math.cos(angle);
        const z = arcRadius * Math.sin(angle); // This z is relative to penalty spot

        arcPoints.push(new THREE.Vector3(x, 0.01, penaltySpotZ + z));
    }

    if (arcPoints.length > 1) {
        this.scene.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(arcPoints),
            lineMaterial
        ));
    }
}


    private createGoal(goalLineZ: number): void {
        const postMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xE0E0E0, 
            roughness: 0.2, 
            metalness: 0.8 
        });
        const postGeo = new THREE.CylinderGeometry(0.06, 0.06, FIELD.GOAL_HEIGHT, 12);
        
        // 左门柱
        const leftPost = new THREE.Mesh(postGeo, postMaterial);
        leftPost.position.set(-FIELD.GOAL_WIDTH / 2, FIELD.GOAL_HEIGHT / 2, goalLineZ);
        leftPost.castShadow = true;
        this.scene.add(leftPost);

        // 右门柱
        const rightPost = new THREE.Mesh(postGeo, postMaterial);
        rightPost.position.set(FIELD.GOAL_WIDTH / 2, FIELD.GOAL_HEIGHT / 2, goalLineZ);
        rightPost.castShadow = true;
        this.scene.add(rightPost);

        // 横梁
        const crossbar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, FIELD.GOAL_WIDTH, 12),
            postMaterial
        );
        crossbar.position.set(0, FIELD.GOAL_HEIGHT, goalLineZ);
        crossbar.rotation.z = Math.PI / 2;
        crossbar.castShadow = true;
        this.scene.add(crossbar);

        // 球网
        this.createNet(goalLineZ);
    }

    private createNet(goalLineZ: number): void {
        const netMaterial = new THREE.MeshBasicMaterial({
            color: 0xDDDDDD,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
            side: THREE.DoubleSide
        });

        const sideSign = Math.sign(goalLineZ);
        const netShapeDepth = FIELD.GOAL_DEPTH * 0.5;
        const netBottomDepth = FIELD.GOAL_DEPTH;

        const vertices: { [key: string]: THREE.Vector3 } = {
            ftl: new THREE.Vector3(-FIELD.GOAL_WIDTH / 2, FIELD.GOAL_HEIGHT, 0),
            ftr: new THREE.Vector3(FIELD.GOAL_WIDTH / 2, FIELD.GOAL_HEIGHT, 0),
            fbl: new THREE.Vector3(-FIELD.GOAL_WIDTH / 2, 0, 0),
            fbr: new THREE.Vector3(FIELD.GOAL_WIDTH / 2, 0, 0),
            btl: new THREE.Vector3(-FIELD.GOAL_WIDTH / 2 * 0.9, FIELD.GOAL_HEIGHT - FIELD.GOAL_DEPTH * 0.2, sideSign * netShapeDepth),
            btr: new THREE.Vector3(FIELD.GOAL_WIDTH / 2 * 0.9, FIELD.GOAL_HEIGHT - FIELD.GOAL_DEPTH * 0.2, sideSign * netShapeDepth),
            bbl: new THREE.Vector3(-FIELD.GOAL_WIDTH / 2, 0, sideSign * netBottomDepth),
            bbr: new THREE.Vector3(FIELD.GOAL_WIDTH / 2, 0, sideSign * netBottomDepth)
        };

        for (const key in vertices) {
            vertices[key].z += goalLineZ;
        }

        const v_map: { [key: string]: number } = { 'ftl':0, 'ftr':1, 'fbl':2, 'fbr':3, 'btl':4, 'btr':5, 'bbl':6, 'bbr':7 };
        const vertex_array = [
            vertices.ftl, vertices.ftr, vertices.fbl, vertices.fbr,
            vertices.btl, vertices.btr, vertices.bbl, vertices.bbr
        ];

        // 创建网面
        const createNetFace = (v_indices: string[][]): THREE.Mesh => {
            const geometry = new THREE.BufferGeometry();
            const face_vertices: number[] = [];
            v_indices.forEach(index_group => {
                face_vertices.push(
                    vertex_array[v_map[index_group[0]]].x, vertex_array[v_map[index_group[0]]].y, vertex_array[v_map[index_group[0]]].z,
                    vertex_array[v_map[index_group[1]]].x, vertex_array[v_map[index_group[1]]].y, vertex_array[v_map[index_group[1]]].z,
                    vertex_array[v_map[index_group[2]]].x, vertex_array[v_map[index_group[2]]].y, vertex_array[v_map[index_group[2]]].z
                );
            });
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(face_vertices, 3));
            geometry.computeVertexNormals();
            return new THREE.Mesh(geometry, netMaterial);
        };

        // 添加各个网面
        const backNetIndices = [ ['bbl','btl','btr'], ['bbl','btr','bbr'] ];
        this.scene.add(createNetFace(backNetIndices));

        const leftNetIndices = [ ['fbl','ftl','btl'], ['fbl','btl','bbl'] ];
        this.scene.add(createNetFace(leftNetIndices));

        const rightNetIndices = [ ['fbr','bbr','btr'], ['fbr','btr','ftr'] ];
        this.scene.add(createNetFace(rightNetIndices));

        const topNetIndices = [ ['ftl', 'ftr', 'btr'], ['ftl', 'btr', 'btl'] ];
        this.scene.add(createNetFace(topNetIndices));
    }
} 