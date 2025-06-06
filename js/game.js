import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { FIELD, PHYSICS, SIZES } from './constants.js';
import { Ball } from './models/ball.js';
import { Player } from './models/player.js';
import { Wall } from './models/wall.js';
import { Goalkeeper } from './models/goalkeeper.js';
import { Field } from './models/field.js';

class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.ball = null;
        this.player = null;
        this.wall = null;
        this.goalkeeper = null;
        
        this.power = 0;
        this.maxPower = 100;
        this.isCharging = false;
        this.shootDirection = new THREE.Vector3();
        this.ballVelocity = new THREE.Vector3();
        this.cameraRotation = { x: Math.PI / 10, y: Math.PI };
        this.isPointerLocked = false;
        this.gameStarted = false;
        
        this.shotsCount = 0;
        this.goalsCount = 0;
        
        this.animationFrameId = null;
        this.lastShotTime = 0;
        
        this.init();
    }

    init() {
        try {
            console.log("开始初始化")
            this.createScene();
            this.createCamera();
            this.createRenderer();
            this.createLights();
            this.createField();
            this.createBall();
            this.createPlayer();
            this.createWall();
            this.createGoalkeeper();
            this.setupEventListeners();
            document.querySelector('.loading').style.display = 'none';
            this.animate();
        } catch (e) {
            console.error('初始化错误:', e);
            document.getElementById('error-message').textContent = `初始化错误: ${e.message}`;
            document.getElementById('error-message').style.display = 'block';
        }
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
    }

    createCamera() {
        const container = document.getElementById('game-container');
        this.camera = new THREE.PerspectiveCamera(
            50,
            container.offsetWidth / container.offsetHeight,
            0.1,
            2000
        );
    }

    createRenderer() {
        const container = document.getElementById('game-container');
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            powerPreference: 'high-performance' 
        });
        this.renderer.setSize(container.offsetWidth, container.offsetHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);
    }

    createLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(
            FIELD.WIDTH * 0.4,
            FIELD.LENGTH * 0.5,
            -FIELD.LENGTH / 2 + FIELD.LENGTH * 0.3
        );
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 10;
        directionalLight.shadow.camera.far = FIELD.LENGTH * 1.5;
        directionalLight.shadow.camera.left = -FIELD.WIDTH * 0.75;
        directionalLight.shadow.camera.right = FIELD.WIDTH * 0.75;
        directionalLight.shadow.camera.top = FIELD.LENGTH * 0.75;
        directionalLight.shadow.camera.bottom = -FIELD.LENGTH * 0.75;
        this.scene.add(directionalLight);
    }

    createField() {
        this.field = new Field(this.scene);
    }

    createBall() {
        const initialPosition = new THREE.Vector3(0, SIZES.BALL_RADIUS, -FIELD.LENGTH / 2 + 25);
        this.ball = new Ball(this.scene, initialPosition);
    }

    createPlayer() {
        const initialPosition = this.ball.position.clone();
        initialPosition.z += 1.0;
        this.player = new Player(this.scene, initialPosition);
    }

    createWall() {
        this.wall = new Wall(this.scene, this.ball.position, -FIELD.LENGTH / 2);
    }

    createGoalkeeper() {
        this.goalkeeper = new Goalkeeper(this.scene, -FIELD.LENGTH / 2);
    }

    setupEventListeners() {
        document.getElementById('start-game').addEventListener('click', () => {
            this.gameStarted = true;
            document.getElementById('start-game').style.display = 'none';
            document.getElementById('crosshair').style.display = 'block';
            this.renderer.domElement.requestPointerLock();
        });

        this.renderer.domElement.addEventListener('mousedown', (e) => {
            if (!this.gameStarted || !this.isPointerLocked || this.ballVelocity.lengthSq() > 0.001) return;
            if (e.button === 0) this.startCharging();
        });

        document.addEventListener('mouseup', (e) => {
            if (!this.gameStarted || !this.isPointerLocked || !this.isCharging) return;
            if (e.button === 0) this.shoot();
        });

        document.addEventListener('mousemove', this.onPointerMove.bind(this));
        document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
        
        document.querySelectorAll('.position-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.isCharging || this.ballVelocity.lengthSq() > 0.001) return;
                document.querySelectorAll('.position-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.changePosition(btn.getAttribute('data-pos'));
            });
        });

        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    onPointerMove(event) {
        if (!this.gameStarted || !this.isPointerLocked) return;
        if (this.isCharging) {
            this.addCurve(event.movementX);
        } else {
            this.cameraRotation.y -= event.movementX * 0.0025;
            this.cameraRotation.x -= event.movementY * 0.0025;
            this.cameraRotation.x = Math.max(-Math.PI / 2 * 0.1, Math.min(Math.PI / 2 * 0.48, this.cameraRotation.x));
            this.updateCamera();
        }
    }

    onPointerLockChange() {
        this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
        document.getElementById('crosshair').style.display = this.isPointerLocked ? 'block' : 'none';

        if (!this.isPointerLocked && this.isCharging) {
            this.isCharging = false;
            this.power = 0;
            this.updatePowerMeter();
            document.querySelector('.curve-indicator').style.display = 'none';
        }
    }

    startCharging() {
        if (this.ballVelocity.lengthSq() < 0.001 && 
            this.player.group.position.distanceTo(this.ball.position) < SIZES.PLAYER_HEIGHT * 1.5) {
            this.isCharging = true;
            this.power = 0;
            this.powerChargeDirection = 1;
            this.curveAmount = 0;
            this.updatePowerMeter();
            document.querySelector('.curve-value').textContent = this.curveAmount.toFixed(1);
            document.querySelector('.curve-indicator').style.display = 'block';
        }
    }

    addCurve(movementX) {
        this.curveAmount -= movementX * 0.008;
        this.curveAmount = Math.max(-2.0, Math.min(2.0, this.curveAmount));
        document.querySelector('.curve-value').textContent = this.curveAmount.toFixed(1);
    }

    shoot() {
        if (!this.isCharging) return;

        this.isCharging = false;
        this.shotsCount++;
        document.getElementById('shots-count').textContent = this.shotsCount;
        this.updateSuccessRate();
        document.querySelector('.curve-indicator').style.display = 'none';

        this.camera.getWorldDirection(this.shootDirection);
        this.ballVelocity.copy(this.shootDirection).multiplyScalar(this.power);

        let pitchAngleForLift = this.cameraRotation.x > 0 ? this.cameraRotation.x : 0;
        this.ballVelocity.y += (this.power / this.maxPower) * 10 * (0.3 + Math.sin(pitchAngleForLift));

        if (Math.abs(this.curveAmount) > 0.05) {
            const sideVector = new THREE.Vector3()
                .crossVectors(this.shootDirection, new THREE.Vector3(0, 1, 0))
                .normalize();
            this.ballVelocity.add(
                sideVector.multiplyScalar(this.curveAmount * (this.power / this.maxPower) * 20)
            );
        }

        this.animateShot();
    }

    animateShot() {
        let prevTime = performance.now();

        const shotLoop = (currentTime) => {
            this.animationFrameId = requestAnimationFrame(shotLoop);
            const deltaTime = Math.min(0.033, (currentTime - prevTime) / 1000);
            prevTime = currentTime;

            if (this.ballVelocity.lengthSq() < 0.0001 && this.ball.position.y <= SIZES.BALL_RADIUS + 0.01) {
                this.ballVelocity.set(0, 0, 0);
                if (!this.checkGoal()) this.showResult("未进球");
                setTimeout(() => this.resetBallAndPlayer(), 1500);
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
                return;
            }

            // 物理更新
            this.updatePhysics(deltaTime);

            // 碰撞检测
            this.checkCollisions();

            // 检查进球
            if (this.checkGoal()) {
                this.showResult("进球！GOAL!");
                this.goalsCount++;
                document.getElementById('goals-count').textContent = this.goalsCount;
                this.updateSuccessRate();
                setTimeout(() => this.resetBallAndPlayer(), 1500);
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
                return;
            }

            // 检查出界
            if (this.checkOutOfBounds(currentTime)) {
                if (!this.checkGoal()) this.showResult("未进球");
                setTimeout(() => this.resetBallAndPlayer(), 1500);
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
                return;
            }
        };

        this.lastShotTime = performance.now();
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        shotLoop(this.lastShotTime);
    }

    updatePhysics(deltaTime) {
        // 空气阻力
        const speed = this.ballVelocity.length();
        if (speed > 0.01) {
            const dragForce = this.ballVelocity.clone()
                .normalize()
                .multiplyScalar(-PHYSICS.AIR_RESISTANCE * speed * speed * deltaTime);
            this.ballVelocity.add(dragForce);
        }

        // 重力
        this.ballVelocity.add(PHYSICS.GRAVITY.clone().multiplyScalar(deltaTime));

        // 更新位置
        this.ball.position.add(this.ballVelocity.clone().multiplyScalar(deltaTime));

        // 更新旋转
        this.ball.rotation.x += this.ballVelocity.z * deltaTime * 2;
        this.ball.rotation.z -= this.ballVelocity.x * deltaTime * 2;

        // 地面碰撞和摩擦
        if (this.ball.position.y < SIZES.BALL_RADIUS) {
            this.ball.position.y = SIZES.BALL_RADIUS;
            this.ballVelocity.y *= -PHYSICS.RESTITUTION;

            if (Math.abs(this.ballVelocity.y) < 0.5) {
                const friction = this.ballVelocity.clone()
                    .setY(0)
                    .normalize()
                    .multiplyScalar(-PHYSICS.GROUND_FRICTION * 9.81 * deltaTime);
                
                if (this.ballVelocity.clone().setY(0).lengthSq() > friction.lengthSq()) {
                    this.ballVelocity.add(friction);
                } else {
                    this.ballVelocity.x = 0;
                    this.ballVelocity.z = 0;
                }
            }
        }
    }

    checkCollisions() {
        // 人墙碰撞
        const wallCollision = this.wall.checkCollision(this.ball.position, SIZES.BALL_RADIUS);
        if (wallCollision.collided) {
            const reflectDir = this.ball.position.clone()
                .sub(wallCollision.playerPosition)
                .normalize();
            const speedBeforeHit = this.ballVelocity.length();
            this.ballVelocity.copy(reflectDir)
                .multiplyScalar(speedBeforeHit * 0.4);
            this.ballVelocity.y = Math.abs(this.ballVelocity.y * 0.3);
            this.showResult("击中人墙!");
            return;
        }

        // 守门员扑救
        const saveResult = this.goalkeeper.checkSave(this.ball.position, SIZES.BALL_RADIUS);
        if (saveResult.saved) {
            this.showResult("守门员扑出!");
            const reflectDir = this.ball.position.clone()
                .sub(saveResult.goalkeeperPosition)
                .normalize();
            this.ballVelocity.copy(reflectDir)
                .multiplyScalar(this.ballVelocity.length() * 0.5);
            this.ballVelocity.y = Math.abs(this.ballVelocity.y * 0.5) + Math.random() * 2;
            return;
        }

        // 门框碰撞
        this.checkGoalpostCollision();
    }

    checkGoalpostCollision() {
        const postCheckBuffer = SIZES.BALL_RADIUS * 2;
        const nearGoalLineZ = (this.ball.position.z < -FIELD.LENGTH / 2 + postCheckBuffer && 
                             this.ball.position.z > -FIELD.LENGTH / 2 - FIELD.GOAL_DEPTH - postCheckBuffer);

        if (nearGoalLineZ) {
            const postRadius = 0.06;
            
            // 左门柱
            if (Math.hypot(this.ball.position.x - (-FIELD.GOAL_WIDTH / 2), 
                          this.ball.position.z - (-FIELD.LENGTH / 2)) < SIZES.BALL_RADIUS + postRadius && 
                this.ball.position.y < FIELD.GOAL_HEIGHT + postRadius && 
                this.ball.position.y > -postRadius) {
                this.ballVelocity.x *= -PHYSICS.POST_RESTITUTION;
                this.ballVelocity.z *= (Math.random() * 0.5 - 0.25);
                this.showResult("中柱!");
            }
            
            // 右门柱
            if (Math.hypot(this.ball.position.x - (FIELD.GOAL_WIDTH / 2), 
                          this.ball.position.z - (-FIELD.LENGTH / 2)) < SIZES.BALL_RADIUS + postRadius && 
                this.ball.position.y < FIELD.GOAL_HEIGHT + postRadius && 
                this.ball.position.y > -postRadius) {
                this.ballVelocity.x *= -PHYSICS.POST_RESTITUTION;
                this.ballVelocity.z *= (Math.random() * 0.5 - 0.25);
                this.showResult("中柱!");
            }
            
            // 横梁
            if (Math.abs(this.ball.position.y - FIELD.GOAL_HEIGHT) < SIZES.BALL_RADIUS + postRadius && 
                Math.abs(this.ball.position.x) < FIELD.GOAL_WIDTH / 2 && 
                Math.abs(this.ball.position.z - (-FIELD.LENGTH / 2)) < postRadius * 2) {
                this.ballVelocity.y *= -PHYSICS.POST_RESTITUTION;
                this.ballVelocity.z *= (Math.random() * 0.5 - 0.25);
                this.showResult("中楣!");
            }
        }
    }

    checkGoal() {
        const goalLine = -FIELD.LENGTH / 2;
        const inGoalPlane = (this.ball.position.z < goalLine + SIZES.BALL_RADIUS && 
                           this.ball.position.z > goalLine - FIELD.GOAL_DEPTH - SIZES.BALL_RADIUS);
        
        return (inGoalPlane &&
                Math.abs(this.ball.position.x) < FIELD.GOAL_WIDTH / 2 - SIZES.BALL_RADIUS &&
                this.ball.position.y < FIELD.GOAL_HEIGHT - SIZES.BALL_RADIUS && 
                this.ball.position.y > SIZES.BALL_RADIUS);
    }

    checkOutOfBounds(currentTime) {
        if (currentTime - this.lastShotTime <= 500) return false;

        const goalLineToCheck = -FIELD.LENGTH / 2;
        const behindGoal = this.ball.position.z < goalLineToCheck - FIELD.GOAL_DEPTH - SIZES.BALL_RADIUS;
        const sideOut = Math.abs(this.ball.position.x) > FIELD.WIDTH / 2 + SIZES.BALL_RADIUS;
        const tooHighAndPast = this.ball.position.y > FIELD.GOAL_HEIGHT + 5 && 
                              Math.abs(this.ball.position.z) > Math.abs(goalLineToCheck);

        return behindGoal || sideOut || tooHighAndPast;
    }

    changePosition(pos) {
        let newX = 0;
        let distToGoalLine = 25;

        switch (pos) {
            case 'left': 
                newX = -FIELD.WIDTH * 0.2; 
                distToGoalLine = 22; 
                break;
            case 'right': 
                newX = FIELD.WIDTH * 0.2; 
                distToGoalLine = 22; 
                break;
            case 'center': 
                newX = 0; 
                distToGoalLine = 28; 
                break;
        }

        const initialPosition = new THREE.Vector3(
            newX,
            SIZES.BALL_RADIUS,
            -FIELD.LENGTH / 2 + distToGoalLine
        );

        this.resetBallAndPlayer(initialPosition);
    }

    resetBallAndPlayer(initialPosition = null) {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (initialPosition) {
            this.ball.position.copy(initialPosition);
        } else {
            this.ball.position.copy(this.ball.initialPosition);
        }

        this.ball.rotation.set(0, 0, 0);
        this.ballVelocity.set(0, 0, 0);

        if (this.player) {
            this.player.reset();
        }

        this.cameraRotation.y = Math.PI;
        this.cameraRotation.x = Math.PI / 10;

        this.power = 0;
        this.curveAmount = 0;
        this.isCharging = false;
        this.updatePowerMeter();
        document.querySelector('.curve-value').textContent = '0.0';
        document.querySelector('.curve-indicator').style.display = 'none';

        this.updateCamera();
        this.createWall();
    }

    updateCamera() {
        if (!this.player || !this.camera) return;

        this.player.update(this.cameraRotation);

        const thirdPersonOffset = new THREE.Vector3(
            0,
            SIZES.PLAYER_HEIGHT * 0.8,
            -SIZES.PLAYER_HEIGHT * 2.2
        );

        const worldOffset = thirdPersonOffset.clone()
            .applyQuaternion(this.player.group.quaternion);
        
        this.camera.position.copy(this.player.group.position)
            .add(worldOffset);

        const cameraEuler = new THREE.Euler(
            this.cameraRotation.x,
            this.cameraRotation.y,
            0,
            'YXZ'
        );
        this.camera.quaternion.setFromEuler(cameraEuler);
    }

    updatePowerMeter() {
        document.querySelector('.power-fill').style.width = 
            (this.power / this.maxPower * 100) + '%';
    }

    updateSuccessRate() {
        const rate = this.shotsCount > 0 ? 
            Math.round((this.goalsCount / this.shotsCount) * 100) : 0;
        document.getElementById('success-rate').textContent = rate + '%';
    }

    showResult(text) {
        const resultEl = document.getElementById('shot-result');
        resultEl.textContent = text;
        resultEl.style.display = 'block';
        setTimeout(() => {
            resultEl.style.display = 'none';
        }, 2000);
    }

    onWindowResize() {
        const container = document.getElementById('game-container');
        if (container.offsetWidth === 0 || container.offsetHeight === 0) return;
        
        this.camera.aspect = container.offsetWidth / container.offsetHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.offsetWidth, container.offsetHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const currentTime = performance.now();

        if (this.isCharging) {
            this.power += 0.5 * this.powerChargeDirection;
            if (this.power >= this.maxPower) {
                this.power = this.maxPower;
                this.powerChargeDirection = -1;
            } else if (this.power <= 0) {
                this.power = 0;
                this.powerChargeDirection = 1;
            }
            this.updatePowerMeter();
        }

        if (this.goalkeeper) {
            this.goalkeeper.update(this.ball.position, this.ballVelocity);
        }

        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        document.removeEventListener('mousemove', this.onPointerMove.bind(this));
        document.removeEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
}

// 初始化游戏
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init()
    window.addEventListener('beforeunload', () => game.dispose());
}); 