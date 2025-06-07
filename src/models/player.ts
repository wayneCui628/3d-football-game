import * as THREE from "three";
import { SIZES } from '@/stores/constants';

interface PlayerPosition {
    x: number;
    y: number;
    z: number;
}

export class Player {
    private scene: THREE.Scene;
    private initialPosition: PlayerPosition;
    private group: THREE.Group;

    constructor(scene: THREE.Scene, initialPosition: PlayerPosition) {
        this.scene = scene;
        this.initialPosition = initialPosition;
        this.group = new THREE.Group();
        this.createPlayer();
        this.scene.add(this.group);
    }

    private createPlayer(): void {
        // 球员身体材质
        const playerBodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x22AA22, 
            roughness: 0.6, 
            metalness: 0.2 
        });
        
        // 球员皮肤材质
        const playerSkinMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFE0BD, 
            roughness: 0.5 
        });

        // 创建躯干
        const torsoRadius = 0.25 * (SIZES.PLAYER_HEIGHT / 1.8);
        const torsoHeight = 0.7 * (SIZES.PLAYER_HEIGHT / 1.8);

        // 圆柱部分
        const cylinderGeom = new THREE.CylinderGeometry(torsoRadius, torsoRadius, torsoHeight, 16);
        const cylinder = new THREE.Mesh(cylinderGeom, playerBodyMaterial);
        cylinder.position.y = torsoHeight / 2 + torsoRadius;
        cylinder.castShadow = true;
        this.group.add(cylinder);

        // 顶部半球
        const topSphereGeom = new THREE.SphereGeometry(torsoRadius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const topSphere = new THREE.Mesh(topSphereGeom, playerBodyMaterial);
        topSphere.position.y = cylinder.position.y + torsoHeight / 2;
        topSphere.castShadow = true;
        this.group.add(topSphere);

        // // 底部半球
        // const bottomSphereGeom = new THREE.SphereGeometry(torsoRadius, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        // const bottomSphere = new THREE.Mesh(bottomSphereGeom, playerBodyMaterial);
        // bottomSphere.position.y = cylinder.position.y - torsoHeight / 2;
        // bottomSphere.rotation.x = Math.PI;
        // bottomSphere.castShadow = true;
        // this.group.add(bottomSphere);

        // 头部
        const headGeom = new THREE.SphereGeometry(0.2 * (SIZES.PLAYER_HEIGHT / 1.8), 16, 12);
        const head = new THREE.Mesh(headGeom, playerSkinMaterial);
        head.position.y = topSphere.position.y + torsoRadius + 0.05 * (SIZES.PLAYER_HEIGHT / 1.8);
        head.castShadow = true;
        this.group.add(head);

        // 设置初始位置
        this.reset();
    }

    public reset(): void {
        this.group.position.copy(this.initialPosition as THREE.Vector3);
        this.group.position.y = 0;
        this.group.position.z += (this.initialPosition.z < 0 ? 1.0 : -1.0);
        this.group.lookAt(new THREE.Vector3(0, SIZES.PLAYER_HEIGHT / 2, 0));
    }

    public getGroup(): THREE.Group {
        return this.group;
    }
} 