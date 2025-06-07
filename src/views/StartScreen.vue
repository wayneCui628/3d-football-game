<template>
  <div class="start-screen" v-if="!gameStarted">
    <div class="start-container">
      <h1 class="title">3D 足球游戏</h1>
      <p class="description">测试你的任意球技巧，尝试攻破守门员的防线！</p>
      <button class="start-button" @click="startGame">开始游戏</button>
      <div class="instructions">
        <h2>游戏说明</h2>
        <ul>
          <li>使用鼠标移动来瞄准</li>
          <li>按住鼠标左键蓄力射门</li>
          <li>蓄力时移动鼠标来控制弧线</li>
          <li>尝试射门得分，避开守门员和人墙</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const gameStarted = ref(false);

const startGame = () => {
  gameStarted.value = true;
  // 触发事件通知父组件游戏已开始
  emit("gameStart");
};

const emit = defineEmits(["gameStart"]);
</script>

<style lang="less" scoped>
.start-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, @primary-color, @secondary-color);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.start-container {
  background-color: rgba(@white, 0.9);
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  max-width: 500px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.title {
  font-size: 36px;
  color: @primary-color;
  margin-bottom: 16px;
}

.description {
  font-size: 18px;
  color: @text-color;
  margin-bottom: 30px;
}

.start-button {
  background-color: @secondary-color;
  color: @white;
  border: none;
  padding: 14px 40px;
  font-size: 20px;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 30px;

  &:hover {
    background-color: @primary-color;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  }
}

.instructions {
  text-align: left;
  border-top: 1px solid #ddd;
  padding-top: 20px;

  h2 {
    font-size: 20px;
    color: @primary-color;
    margin-bottom: 10px;
  }

  ul {
    padding-left: 20px;
  }

  li {
    margin-bottom: 8px;
    color: @text-color;
  }
}
</style>
