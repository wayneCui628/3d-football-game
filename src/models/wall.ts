import * as THREE from "three";
import { SIZES } from '@/stores/constants';

interface CollisionResult {
    collided: boolean;
    playerPosition?: THREE.Vector3;
}

export class Wall {
    private scene: THREE.Scene;
    private ballPosition: THREE.Vector3;
    private targetGoalZ: number;
    private players: THREE.Group[];

    constructor(scene: THREE.Scene, ballPosition: THREE.Vector3, targetGoalZ: number) {
        this.scene = scene;
        this.ballPosition = ballPosition;
        this.targetGoalZ = targetGoalZ;
        this.players = [];
        this.createWall();
    }

    private createWall(): void {
        // 移除现有人墙
        this.players.forEach(group => {
            group.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            this.scene.remove(group);
        });
        this.players = [];

        const wallPlayerMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xDD4444, 
            roughness: 0.7 
        });

        // 计算人墙位置
        const wallDistanceToBall = 9.15;
        const wallCenter = new THREE.Vector3().lerpVectors(
            this.ballPosition,
            new THREE.Vector3(0, 0, this.targetGoalZ),
            wallDistanceToBall / this.ballPosition.distanceTo(new THREE.Vector3(0, 0, this.targetGoalZ))
        );
        wallCenter.y = 0;

        const numWallPlayers = 5;
        const wallSpacing = SIZES.PLAYER_HEIGHT * 0.6;

        // 创建人墙球员
        for (let i = 0; i < numWallPlayers; i++) {
            const wallPlayerGroup = new THREE.Group();

            // 创建躯干
            const torsoRadiusW = 0.25 * (SIZES.PLAYER_HEIGHT / 1.8);
            const torsoHeightW = 0.7 * (SIZES.PLAYER_HEIGHT / 1.8);

            // 圆柱部分
            const cylinderGeomW = new THREE.CylinderGeometry(torsoRadiusW, torsoRadiusW, torsoHeightW, 12);
            const cylinderW = new THREE.Mesh(cylinderGeomW, wallPlayerMaterial);
            cylinderW.position.y = torsoHeightW / 2 + torsoRadiusW;
            cylinderW.castShadow = true;
            wallPlayerGroup.add(cylinderW);

            // 顶部半球
            const topSphereGeomW = new THREE.SphereGeometry(torsoRadiusW, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
            const topSphereW = new THREE.Mesh(topSphereGeomW, wallPlayerMaterial);
            topSphereW.position.y = cylinderW.position.y + torsoHeightW / 2;
            topSphereW.castShadow = true;
            wallPlayerGroup.add(topSphereW);

            // 底部半球
            const bottomSphereGeomW = new THREE.SphereGeometry(torsoRadiusW, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
            const bottomSphereW = new THREE.Mesh(bottomSphereGeomW, wallPlayerMaterial);
            bottomSphereW.position.y = cylinderW.position.y - torsoHeightW / 2;
            bottomSphereW.rotation.x = Math.PI;
            bottomSphereW.castShadow = true;
            wallPlayerGroup.add(bottomSphereW);

            // 头部
            const headGeomW = new THREE.SphereGeometry(0.2 * (SIZES.PLAYER_HEIGHT / 1.8), 12, 8);
            const headW = new THREE.Mesh(headGeomW, new THREE.MeshStandardMaterial({ 
                color: 0xFFCCAA, 
                roughness: 0.5 
            }));
            headW.position.y = topSphereW.position.y + torsoRadiusW + 0.05 * (SIZES.PLAYER_HEIGHT / 1.8);
            headW.castShadow = true;
            wallPlayerGroup.add(headW);

            // 设置人墙位置
            const offsetX = (i - (numWallPlayers - 1) / 2) * wallSpacing;
            const directionToGoal = new THREE.Vector3(0, 0, this.targetGoalZ)
                .sub(this.ballPosition)
                .normalize();
            const wallLineDir = new THREE.Vector3()
                .crossVectors(directionToGoal, new THREE.Vector3(0, 1, 0))
                .normalize();

            wallPlayerGroup.position.copy(wallCenter)
                .add(wallLineDir.clone().multiplyScalar(offsetX));
            wallPlayerGroup.position.y = 0;
            wallPlayerGroup.lookAt(this.ballPosition.x, SIZES.PLAYER_HEIGHT / 2, this.ballPosition.z);
            
            this.scene.add(wallPlayerGroup);
            this.players.push(wallPlayerGroup);
        }
    }

    public checkCollision(ballPosition: THREE.Vector3, ballRadius: number): CollisionResult {
        for (const playerGroup of this.players) {
            const playerBody = playerGroup.children[0] as THREE.Mesh;
            const playerPos = playerGroup.position.clone().add(playerBody.position);
            const distToPlayer = ballPosition.distanceTo(playerPos);
            
            if (distToPlayer < ballRadius + (playerBody.geometry as THREE.CylinderGeometry).parameters.radiusTop) {
                return {
                    collided: true,
                    playerPosition: playerPos
                };
            }
        }
        return { collided: false };
    }
} 