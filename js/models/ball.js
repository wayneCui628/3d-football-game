import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { SIZES, PHYSICS } from '../constants.js';

export class Ball {
    constructor(scene, initialPosition) {
        this.scene = scene;
        this.initialPosition = initialPosition;
        this.velocity = new THREE.Vector3();
        this.createBall();
    }

    createBall() {
        const geometry = new THREE.IcosahedronGeometry(SIZES.BALL_RADIUS, 3);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.1,
            map: this.createBallTexture()
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.initialPosition);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
    }

    createBallTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // 背景白色
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 绘制黑色五边形和六边形
        ctx.fillStyle = '#000000';
        const panelSize = 20;

        // 居中的五边形
        this.drawPolygon(ctx, canvas.width / 2, canvas.height / 2, panelSize, 5, 0);

        // 周围的六边形
        this.drawPolygon(ctx, canvas.width / 2 + panelSize * 1.8, canvas.height / 2, panelSize * 0.9, 6, Math.PI / 6);
        this.drawPolygon(ctx, canvas.width / 2 - panelSize * 1.8, canvas.height / 2, panelSize * 0.9, 6, Math.PI / 6);
        this.drawPolygon(ctx, canvas.width / 2, canvas.height / 2 + panelSize * 1.6, panelSize * 0.9, 6, 0);
        this.drawPolygon(ctx, canvas.width / 2, canvas.height / 2 - panelSize * 1.6, panelSize * 0.9, 6, 0);

        // 添加点缀
        ctx.fillStyle = '#555555';
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.encoding = THREE.sRGBEncoding;
        return texture;
    }

    drawPolygon(ctx, x, y, radius, sides, angleOffset) {
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2 + angleOffset;
            const px = x + radius * Math.cos(angle);
            const py = y + radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    update(deltaTime) {
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

    reset() {
        this.mesh.position.copy(this.initialPosition);
        this.mesh.rotation.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
    }

    isMoving() {
        return this.velocity.lengthSq() > 0.0001;
    }

    isStopped() {
        return !this.isMoving() && this.mesh.position.y <= SIZES.BALL_RADIUS + 0.01;
    }
} 