const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const {
  layers,
  width,
  height,
  description,
  baseImageUri,
  editionSize,
  startEditionFrom,
  rarityWeights,
} = require("./input/config.js");
const console = require("console");
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

// holds metadata for all NFTs
var metadataList = [];
const dir = __dirname;

// saves the generated image to the output folder, using the edition count as the name
const saveImage = (_editionCount) => {
  fs.writeFileSync(
    `./output/${_editionCount}.png`,
    canvas.toBuffer("image/png")
  );
};

// adds a signature to the top left corner of the canvas
const signImage = (_sig) => {
  ctx.fillStyle = "#000000";
  ctx.font = "bold 30pt Courier";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(_sig, 40, 40);
};

// generate a random color hue
const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  let pastel = `hsl(${hue}, 100%, 85%)`;
  return pastel;
};

const drawBackground = () => {
  ctx.fillStyle = genColor();
  ctx.fillRect(0, 0, width, height);
};

// add metadata for individual nft edition
const generateMetadata = (_edition, _attributesList, name) => {
  let dateTime = Date.now();
  let tempMetadata = {
    // dna: _dna.join(""),
    edition: _edition,
    name: name,
    description: description,
    image: `${baseImageUri}/${_edition}`,
    // date: dateTime,
    attributes: _attributesList,
  };
  return tempMetadata;
};

// prepare attributes for the given element to be used as metadata
const getAttributeForElement = (_element) => {
  let selectedElement = _element.layer.selectedElement;
  let attribute = {
    trait_type: selectedElement.name,
    value: selectedElement.rarity,
  };
  return attribute;
};

// loads an image from the layer path
// returns the image in a format usable by canvas
const loadLayerImg = async (_layer) => {
  return new Promise(async (resolve) => {
    const image = await loadImage(`${_layer.selectedElement.path}`);
    resolve({ layer: _layer, loadedImage: image });
  });
};

const drawElement = (_element) => {
  ctx.drawImage(
    _element.loadedImage,
    _element.layer.position.x,
    _element.layer.position.y,
    _element.layer.size.width,
    _element.layer.size.height
  );
};

// check the configured layer to find information required for rendering the layer
// this maps the layer information to the generated dna and prepares it for
// drawing on a canvas
const constructLayerToDna = (_dna = [], _layers = [], _rarity) => {
  let mappedDnaToLayers = _layers.map((layer, index) => {
    let selectedElement = layer.elements.find(
      (element) => element.id === _dna[index]
    );
    return {
      location: layer.location,
      position: layer.position,
      size: layer.size,
      selectedElement: { ...selectedElement, rarity: _rarity },
    };
  });
  return mappedDnaToLayers;
};

// check if the given dna is contained within the given dnaList
// return true if it is, indicating that this dna is already in use and should be recalculated
const isDnaUnique = (_DnaList = [], _dna = []) => {
  let foundDna = _DnaList.find((i) => i.join("") === _dna.join(""));
  return foundDna == undefined ? true : false;
};

const getRandomRarity = (_rarityOptions) => {
  let randomPercent = Math.random() * 100;
  let percentCount = 0;

  for (let i = 0; i <= _rarityOptions.length; i++) {
    percentCount += _rarityOptions[i].percent;
    if (percentCount >= randomPercent) {
      console.log(`use random rarity ${_rarityOptions[i].id}`);
      return _rarityOptions[i].id;
    }
  }
  return _rarityOptions[0].id;
};

// create a dna based on the available layers for the given rarity
// use a random part for each layer
const createDna = (_layers, _rarity) => {
  let randNum = [];
  let _rarityWeight = rarityWeights.find((rw) => rw.value === _rarity);
  _layers.forEach((layer) => {
    let num = Math.floor(
      Math.random() * layer.elementIdsForRarity[_rarity].length
    );
    if (_rarityWeight && _rarityWeight.layerPercent[layer.id]) {
      // if there is a layerPercent defined, we want to identify which dna to actually use here (instead of only picking from the same rarity)
      let _rarityForLayer = getRandomRarity(
        _rarityWeight.layerPercent[layer.id]
      );
      num = Math.floor(
        Math.random() * layer.elementIdsForRarity[_rarityForLayer].length
      );
      randNum.push(layer.elementIdsForRarity[_rarityForLayer][num]);
    } else {
      randNum.push(layer.elementIdsForRarity[_rarity][num]);
    }
  });
  return randNum;
};

// holds which rarity should be used for which image in edition
let rarityForEdition;
// get the rarity for the image by edition number that should be generated
const getRarity = (_editionCount) => {
  if (!rarityForEdition) {
    // prepare array to iterate over
    rarityForEdition = [];
    rarityWeights.forEach((rarityWeight) => {
      for (let i = rarityWeight.from; i <= rarityWeight.to; i++) {
        rarityForEdition.push(rarityWeight.value);
      }
    });
  }
  return rarityForEdition[editionSize - _editionCount];
};

const saveMetaDataSingleFile = (_editionCount) => {
  let metadata = metadataList.find((meta) => meta.edition == _editionCount);
  fs.writeFileSync(
    `./output/json/${_editionCount}.json`,
    JSON.stringify(metadata, null, 2)
  );
};

const writeMetaData = (_data) => {
  fs.writeFileSync("./output/_metadata.json", _data);
};

// holds which dna has already been used during generation
let dnaListByRarity = {};

// Create generative art by using the canvas api
const startCreating = async () => {
  console.log("##################");
  console.log("# Generative Art");
  console.log("# - Create your NFT collection");
  console.log("##################");
  console.log("start creating NFTs.");
  // clear meta data from previous run
  writeMetaData("");
  // create NFTs from startEditionFrom to editionSize
  let editionCount;
  let editionCount2;
  let index = 1;

  for (
    editionCount2 = startEditionFrom;
    editionCount2 <= editionSize;
    editionCount2++
  ) {
    for (
      editionCount = startEditionFrom;
      editionCount <= editionSize;
      editionCount++
    ) {
      if (editionCount2 != editionCount) {
        console.log("-----------------");
        console.log(
          "creating NFT %d of %d",
          index,
          editionSize * (editionSize - 1)
        );

        // propagate information about required layer contained within config into a mapping object

        let results = [];
        results.push({
          location: undefined,
          position: { x: 0, y: 0 },
          size: { width: 1080, height: 1080 },
          selectedElement: layers[0].elements[index % 4],
        });

        results.push({
          location: undefined,
          position: { x: 0, y: 0 },
          size: { width: 1080, height: 1080 },
          selectedElement: layers[1].elements[editionCount - 1],
        });

        results.push({
          location: undefined,
          position: { x: 0, y: 0 },
          size: { width: 1080, height: 1080 },
          selectedElement: layers[2].elements[editionCount2 - 1],
        });

        let loadedElements = [];

        // console.log(results);
        // load all images to be used by canvas
        results.forEach((layer) => {
          loadedElements.push(loadLayerImg(layer));
        });

        // elements are loaded asynchronously
        // -> await for all to be available before drawing the image
        await Promise.all(loadedElements).then((elementArray) => {
          // create empty image
          ctx.clearRect(0, 0, width, height);
          // draw a random background color
          // drawBackground();
          // store information about each layer to add it as meta information
          let attributesList = [];
          // draw each layer
          elementArray.forEach((element) => {
            drawElement(element);
            // attributesList.push(getAttributeForElement(element));
          });

          /* add attribute list */

          let rightCard = elementArray[1].layer.selectedElement.name;
          let arrRight = rightCard.split(" ");
          let leftCard = elementArray[2].layer.selectedElement.name;
          let arrLeft = leftCard.split(" ");
          let name = leftCard + " + " + rightCard;
          let attribute1 = {
            trait_type: "Left Card Value",
            value: arrLeft[0],
          };

          let attribute2 = {
            trait_type: "Left Card Suit",
            value: arrLeft[2],
          };

          let attribute3 = {
            trait_type: "Right Card Value",
            value: arrRight[0],
          };

          let attribute4 = {
            trait_type: "Right Card Suit",
            value: arrRight[2],
          };

          attributesList.push(attribute1);
          attributesList.push(attribute2);
          attributesList.push(attribute3);
          attributesList.push(attribute4);

          // add an image signature as the edition count to the top left of the image
          // signImage(`#${editionCount}`);
          // write the image to the output directory
          saveImage(index);
          let nftMetadata = generateMetadata(index, attributesList, name);
          metadataList.push(nftMetadata);
          saveMetaDataSingleFile(index);
          // console.log("- metadata: " + JSON.stringify(nftMetadata));
          // console.log("- edition " + editionCount + " created.");
          console.log();
        });
        index++;
      }
    }
  }
  writeMetaData(JSON.stringify(metadataList));
};

// reads the filenames of a given folder and returns it with its name and path
const getElements = (_path, _elementCount) => {
  return fs
    .readdirSync(_path)
    .filter((item) => !/(^|\/)\.[^\/\.]/g.test(item))
    .map((i) => {
      return {
        id: _elementCount,
        name: cleanName(i),
        path: `${_path}/${i}`,
      };
    });
};

const cleanName = (_str) => {
  let name = _str.slice(0, -5);
  return name;
};

const startRandom = async () => {
  console.log(`${dir}/output/json/`);

  let entries = getElements(`${dir}/output/json`);
  let randEntries = shuffle(entries);

  for (let i = 0; i < 5555; i++) {
    fs.copyFile(
      randEntries[i].path,
      `${dir}/output/json_rand/${i + 1}.json`,
      (err) => {
        if (err) throw err;
      }
    );
  }

};

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

// Initiate code
// startCreating();
startRandom();
