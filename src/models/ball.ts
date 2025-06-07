import * as THREE from "three";
import { SIZES, PHYSICS, CONTROLS } from '@/stores/constants';


export class Ball {
    private scene: THREE.Scene;
    private initialPosition: THREE.Vector3;
    private velocity: THREE.Vector3;
    private mesh: THREE.Mesh;
    private renderer: THREE.WebGLRenderer | undefined;

    constructor(scene: THREE.Scene, initialPosition: THREE.Vector3, renderer?: THREE.WebGLRenderer ) {
        this.scene = scene;
        this.initialPosition = initialPosition;
        this.velocity = new THREE.Vector3();
        this.renderer = renderer;
        this.createBall();
    }

    private createBall(): void {
        const geometry = new THREE.IcosahedronGeometry(SIZES.BALL_RADIUS, 3); // 保持使用IcosahedronGeometry

        const textureLoader = new THREE.TextureLoader();
        const texturePath = '/assets/football.png'; 

        const ballTexture = textureLoader.load(
            texturePath,
            // onLoad callback
            (texture) => {
                console.log('Ball texture loaded successfully!');
                texture.colorSpace = THREE.SRGBColorSpace; // 非常重要！

                // 需要 renderer 实例来获取 maxAnisotropy
                if (this.renderer) {
                   texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                } else {
                   texture.anisotropy = 16; // 一个常见的默认值
                }

                // 如果材质已经创建并添加到物体，可以手动触发更新：
                if (this.mesh && this.mesh.material instanceof THREE.MeshStandardMaterial) {
                    this.mesh.material.needsUpdate = true;
                }
            },
            // onProgress callback (可选)
            undefined,
            (error) => {
                console.error(`An error occurred loading the ball texture from ${texturePath}:`, error);
            }
        );

        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff, // 基础颜色，如果纹理加载失败或纹理有透明部分会透出
            roughness: 0.3,  // 根据你的纹理和期望效果调整
            metalness: 0.1,  // 根据你的纹理和期望效果调整
            map: ballTexture // 应用纹理
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.initialPosition);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
    }

    public move(direction: THREE.Vector3, power: number, curveAmount?: number):void  {
              this.velocity.copy(direction).multiplyScalar(power);
      
        const pitchAngleForLift =
        direction.x > 0 ? direction.x : 0;
        this.velocity.y +=
          (power / CONTROLS.MAX_POWER) * 10 * (0.3 + Math.sin(pitchAngleForLift));
      
        if (Math.abs(curveAmount) > 0.05) {
          const sideVector = new THREE.Vector3()
            .crossVectors(direction, new THREE.Vector3(0, 1, 0))
            .normalize();
            this.velocity.add(
            sideVector.multiplyScalar(curveAmount * (power / CONTROLS.MAX_POWER) * 20)
          );
        }
      
      };
      
    
    /**
     * 更新球的物理状态
     * @param deltaTime - 时间增量，单位为秒
     */
    public update(deltaTime: number): void {
        // 空气阻力
        const speed = this.velocity.length();
        if (speed > 0.01) {
            const dragForce = this.velocity.clone()
                .normalize()
                .multiplyScalar(-PHYSICS.AIR_RESISTANCE_FACTOR * speed * speed * deltaTime);
            this.velocity.add(dragForce);
        }

        // 重力
        this.velocity.add(PHYSICS.GRAVITY.clone().multiplyScalar(deltaTime));

        // 更新位置
        this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

        // 旋转
        this.mesh.rotation.x += this.velocity.z * deltaTime * 2;
        this.mesh.rotation.z -= this.velocity.x * deltaTime * 2;

        // 地面碰撞和摩擦
        if (this.mesh.position.y < SIZES.BALL_RADIUS) {
            this.mesh.position.y = SIZES.BALL_RADIUS;
            this.velocity.y *= -PHYSICS.RESTITUTION_COEFFICIENT;

            // 地面滚动摩擦
            if (Math.abs(this.velocity.y) < 0.5) {
                const friction = this.velocity.clone()
                    .setY(0)
                    .normalize()
                    .multiplyScalar(-PHYSICS.GROUND_FRICTION_FACTOR * 9.81 * deltaTime);
                if (this.velocity.clone().setY(0).lengthSq() > friction.lengthSq()) {
                    this.velocity.add(friction);
                } else {
                    this.velocity.x = 0;
                    this.velocity.z = 0;
                }
            }
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