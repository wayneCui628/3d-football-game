import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { SIZES, FIELD } from '../constants.js';

export class Goalkeeper {
    constructor(scene, goalLineZ) {
        this.scene = scene;
        this.goalLineZ = goalLineZ;
        this.group = new THREE.Group();
        this.createGoalkeeper();
        this.scene.add(this.group);
    }

    createGoalkeeper() {
        const gkMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4444EE, 
            roughness: 0.6 
        });
        const gkSkinMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFAAAA, 
            roughness: 0.5 
        });

        // 创建躯干
        const torsoRadiusGK = 0.3 * (SIZES.PLAYER_HEIGHT / 1.8);
        const torsoHeightGK = 0.75 * (SIZES.PLAYER_HEIGHT / 1.8);

        // 圆柱部分
        const cylinderGeomGK = new THREE.CylinderGeometry(torsoRadiusGK, torsoRadiusGK, torsoHeightGK, 16);
        const cylinderGK = new THREE.Mesh(cylinderGeomGK, gkMaterial);
        cylinderGK.position.y = torsoHeightGK / 2 + torsoRadiusGK;
        cylinderGK.castShadow = true;
        this.group.add(cylinderGK);

        // 顶部半球
        const topSphereGeomGK = new THREE.SphereGeometry(torsoRadiusGK, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const topSphereGK = new THREE.Mesh(topSphereGeomGK, gkMaterial);
        topSphereGK.position.y = cylinderGK.position.y + torsoHeightGK / 2;
        topSphereGK.castShadow = true;
        this.group.add(topSphereGK);

        // 底部半球
        const bottomSphereGeomGK = new THREE.SphereGeometry(torsoRadiusGK, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        const bottomSphereGK = new THREE.Mesh(bottomSphereGeomGK, gkMaterial);
        bottomSphereGK.position.y = cylinderGK.position.y - torsoHeightGK / 2;
        bottomSphereGK.rotation.x = Math.PI;
        bottomSphereGK.castShadow = true;
        this.group.add(bottomSphereGK);

        // 头部
        const headGeomGK = new THREE.SphereGeometry(0.22 * (SIZES.PLAYER_HEIGHT / 1.8), 16, 12);
        const headGK = new THREE.Mesh(headGeomGK, gkSkinMaterial);
        headGK.position.y = topSphereGK.position.y + torsoRadiusGK + 0.05 * (SIZES.PLAYER_HEIGHT / 1.8);
        headGK.castShadow = true;
        this.group.add(headGK);

        // 设置初始位置
        this.reset();
    }

    reset() {
        this.group.position.set(0, 0, this.goalLineZ - Math.sign(this.goalLineZ) * 0.8);
        this.group.lookAt(new THREE.Vector3(0, SIZES.PLAYER_HEIGHT / 2, 0));
    }

    update(ballPosition, ballVelocity) {
        if (ballVelocity.lengthSq() < 0.001) {
            // 球静止时，守门员做待机动作
            const idleMove = Math.sin(performance.now() * 0.0005) * (FIELD.GOAL_WIDTH * 0.15);
            this.group.position.x = THREE.MathUtils.clamp(
                idleMove,
                -FIELD.GOAL_WIDTH / 2 + 0.5,
                FIELD.GOAL_WIDTH / 2 - 0.5
            );
        } else if (Math.abs(ballPosition.z - this.group.position.z) < 5 && 
                  ballPosition.y < SIZES.PLAYER_HEIGHT * 1.2) {
            // 球在守门员附近且不高时，进行扑救
            const targetX = THREE.MathUtils.clamp(
                ballPosition.x,
                -FIELD.GOAL_WIDTH / 2 * 0.8,
                FIELD.GOAL_WIDTH / 2 * 0.8
            );
            const speed = ballVelocity.length();
            this.group.position.x += (targetX - this.group.position.x) * 
                0.15 * Math.max(0.1, 1 - speed / 30);
        }
    }

    checkSave(ballPosition, ballRadius) {
        const gkBodyPos = this.group.position.clone().add(this.group.children[0].position);
        const diveReach = SIZES.PLAYER_HEIGHT * 0.8;
        
        if (ballPosition.distanceTo(gkBodyPos) < diveReach) {
            return {
                saved: true,
                goalkeeperPosition: gkBodyPos
            };
        }
        return { saved: false };
    }
} 