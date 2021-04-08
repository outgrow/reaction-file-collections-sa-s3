import { Readable, Writable } from "stream";
import S3 from "aws-sdk/clients/s3";
import StorageAdapter from "@reactioncommerce/file-collections-sa-base";
import debug from "./debug";

export default class S3Store extends StorageAdapter {
  constructor({
    collectionPrefix = "fc_sa_s3.",
    fileKeyMaker,
    name,
    objectACL,
    transformRead,
    transformWrite
  } = {}) {
    super({
      fileKeyMaker,
      name,
      transformRead,
      transformWrite
    });

    const s3Params = {};

    if (process.env.AWS_S3_REGION) {
      debug("AWS_S3_REGION:", process.env.AWS_S3_REGION);
      s3Params.region = process.env.AWS_S3_REGION;
    }

    if (process.env.AWS_S3_ENDPOINT) {
      debug("AWS_S3_ENDPOINT:", process.env.AWS_S3_ENDPOINT);
      s3Params.endpoint = process.env.AWS_S3_ENDPOINT;
      s3Params.s3ForcePathStyle = true;
    }

    if (process.env.AWS_ACCESS_KEY_ID) {
      debug("AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID)
      s3Params.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    }

    if (process.env.AWS_SECRET_ACCESS_KEY) {
      debug("AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY)
      s3Params.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    }

    this.s3 = new S3({
      apiVersion: "2006-03-01",
      ...s3Params
    });

    this.collectionName = `${collectionPrefix}${name}`.trim();
    this.objectACL = objectACL;
  }

  _fileKeyMaker(fileRecord) {
    const info = fileRecord.infoForCopy(this.name);

    debug("S3Store _fileKeyMaker fileRecord info:", info);
    debug("S3Store _fileKeyMaker fileRecord size:", fileRecord.size());

    const result = {
      _id: info.key || fileRecord._id,
      filename: info.name || fileRecord.name() || `${fileRecord.collectionName}-${fileRecord._id}`,
      size: info.size || fileRecord.size()
    };

    debug("S3Store _fileKeyMaker result:", result);

    return result;
  }

  /**
   * This retrieves objects from S3 and sends them to reaction-file-collections as a readable stream.
   * The whole point of using S3 being hitting your content's URLs, either directly or through a CDN,
   * this might not be what you're looking for. It's there to preserve reaction-file-collection's default
   * behavior.
   */
  async _getReadStream(fileKey, { start: startPos, end: endPos } = {}) {
    debug("S3Store _getReadStream");

    const opts = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileKey._id
    };

    // Add range if this should be a partial read
    if (typeof startPos === "number" && typeof endPos === "number") {
      opts.Range = `bytes=${startPos}-${endPos}`;
    }

    debug("S3Store _getReadStream opts:", opts);

    const object = await this.s3.getObject(opts).promise();

    debug("S3Store _getReadStream got object:", object);

    let totalTransferredData = 0;

    const stream = new Readable({
      read: (size) => {
        debug(`S3Store read body from ${totalTransferredData} to ${totalTransferredData + size}`);
        const body = object.Body.slice(totalTransferredData, totalTransferredData + size);

        totalTransferredData += size;

        debug(`S3Store _getReadStream transferred ${totalTransferredData}`);

        stream.push(body);

        if ((typeof endPos === "number" && totalTransferredData >= endPos) || totalTransferredData >= fileKey.size) {
          debug("S3Store _getReadStream ending stream");
          stream.push(null);
        }
      }
    });

    return stream;
  }

  async _getWriteStream(fileKey, options = {}) {
    const opts = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `${Date.now()}-${fileKey.filename}`
    };

    debug("S3Store _getWriteStream opts:", opts);
    debug("S3Store _getWriteStream options:", options);
    debug("S3Store _getWriteStream fileKey:", fileKey);
    debug("S3Store _getWriteStream objectACL", this.objectACL);

    let uploadId = "";

    const uploadData = await this.s3.createMultipartUpload({
      ...opts,
      ...(this.objectACL ? { ACL: this.objectACL } : {})
    }).promise();

    debug("s3.createMultipartUpload data:", uploadData);

    if (uploadData.UploadId === undefined) {
      throw new Error("Couldn't get upload ID from S3");
    }

    uploadId = uploadData.UploadId;

    let partNumber = 1;
    let totalFileSize = 0;
    const parts = [];

    const writeStream = new Writable({
      write: async (chunk, encoding, callback) => {
        const partData = await this.s3.uploadPart({
          ...opts,
          Body: chunk,
          UploadId: uploadId,
          PartNumber: partNumber
        }).promise();

        parts.push({
          ETag: partData.ETag,
          PartNumber: partNumber
        });

        debug(`Part ${partNumber} successfully uploaded`, parts);

        partNumber += 1;
        totalFileSize += chunk.length;

        callback();
      }
    });

    writeStream.on("finish", async () => {
      debug("S3Store writeStream finish");
      debug("S3Store writeStream totalFileSize:", totalFileSize);

      const uploadedFile = await this.s3.completeMultipartUpload({
        ...opts,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
        }
      }).promise();

      debug("S3 multipart upload completed", uploadedFile);

      // Emit end and return the fileKey, size, and updated date
      writeStream.emit("stored", {
        // Set the generated _id so that we know it for future reads and writes.
        // We store the _id as a string and only convert to ObjectID right before
        // reading, writing, or deleting.
        fileKey: uploadedFile.Key,
        storedAt: new Date(),
        size: totalFileSize
      });
    });

    return writeStream;
  }

  _removeFile(fileKey) {
    debug("S3Store _removeFile called for fileKey", fileKey);
    if (!fileKey._id) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this.s3.deleteObject({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey._id
      }, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  typeName = "s3";
}
