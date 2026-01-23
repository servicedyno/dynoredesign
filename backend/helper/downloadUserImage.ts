import axios from "axios";
import fs from "fs";

const downloadUserImage = async () => {
  const randomString = (Math.random() + 1).toString(36).substring(2);
  const imageLocation = "images/user_" + randomString + ".png";

  const response = await axios({
    url: "https://picsum.photos/400",
    responseType: "stream",
  });

  await new Promise((resolve, reject) => {
    response.data
      .pipe(fs.createWriteStream("public/" + imageLocation))
      .on("finish", (e) => resolve(e))
      .on("error", (e) => reject(e));
  });
  return imageLocation;
};

export default downloadUserImage;
