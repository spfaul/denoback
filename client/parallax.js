class ParallaxLayer {
  constructor(layerData) {
    this.layerData = layerData;
    this.loaded = false;
  }

  load() {
    if (this.layerData.layers.length === 0) {
      this.loaded = true;
      return;
    }
    let loadedImgs = 0;
    this.layerData.layers.forEach((layer, i) => {
      layer.img = loadImage(layer.imgName, (img) => {
        let s = new Sprite();
        s.collider = "none";
        s.ani = loadAni(img, { frameSize: [img.width, img.height], frames: 1 });
        s.ani.stop();
        // s.scale = { x: 3, y: 2.5 };
        s.scale = this.layerData.scale;
        s.x = 200;
        s.y = 500;
        s.layer = i - this.layerData.layers.length;
        s.visible = false; // hide layers until all loaded
        layer.sprite = s;
        loadedImgs += 1;
        if (loadedImgs === this.layerData.layers.length) {
          this.loaded = true;
          // unhide all layers
          for (let lay of this.layerData.layers) lay.sprite.visible = true;
        }
      });
    });
  }

  update(playerPos) {
    this.layerData.layers.forEach((layer, i) => {
      if (this.loaded) {
        layer.sprite.y = lerp(
          layer.sprite.y,
          this.layerData.center.y +
            (playerPos.y - this.layerData.center.y) * layer.speed,
          this.layerData.smoothness
        );
        layer.sprite.x = lerp(
          layer.sprite.x,
          this.layerData.center.x +
            (playerPos.x - this.layerData.center.x) * layer.speed,
          this.layerData.smoothness
        );

        const layer_left_bound = layer.sprite.x - layer.sprite.w / 2;
        const layer_right_bound = layer.sprite.x + layer.sprite.w / 2;
        const layer_top_bound = layer.sprite.y - layer.sprite.h / 2;
        const layer_bottom_bound = layer.sprite.y + layer.sprite.h / 2;

        if (layer_left_bound > camera.bound.min.x) {
          layer.sprite.x = camera.bound.min.x + layer.sprite.w / 2;
        } else if (layer_right_bound < camera.bound.max.x) {
          layer.sprite.x = camera.bound.max.x - layer.sprite.w / 2;
        }
        if (layer_top_bound > camera.bound.min.y) {
          layer.sprite.y = camera.bound.min.y + layer.sprite.h / 2;
        } else if (layer_bottom_bound < camera.bound.max.y) {
          layer.sprite.y = camera.bound.max.y - layer.sprite.h / 2;
        }
        // layer.sprite.x = max(layer.sprite.x - layer.sprite.w / 2, camera.bound.min.x) + layer.sprite.w / 2;
      }
    });
  }
}
