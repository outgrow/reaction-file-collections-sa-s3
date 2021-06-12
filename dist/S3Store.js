"use strict";var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");Object.defineProperty(exports, "__esModule", { value: true });exports.default = void 0;var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));var _stream = require("stream");
var _s = _interopRequireDefault(require("aws-sdk/clients/s3"));
var _fileCollectionsSaBase = _interopRequireDefault(require("@reactioncommerce/file-collections-sa-base"));
var _debug = _interopRequireDefault(require("./debug"));

class S3Store extends _fileCollectionsSaBase.default {
  constructor({
    collectionPrefix = "fc_sa_s3.",
    fileKeyMaker,
    name,
    isPublic,
    objectACL,
    transformRead,
    transformWrite } =
  {}) {
    super({
      fileKeyMaker,
      name,
      transformRead,
      transformWrite });(0, _defineProperty2.default)(this, "typeName",













































































































































































































    "s3");const s3Params = {};if (process.env.AWS_S3_REGION) {(0, _debug.default)("AWS_S3_REGION:", process.env.AWS_S3_REGION);s3Params.region = process.env.AWS_S3_REGION;}if (process.env.AWS_S3_ENDPOINT) {(0, _debug.default)("AWS_S3_ENDPOINT:", process.env.AWS_S3_ENDPOINT);s3Params.endpoint = process.env.AWS_S3_ENDPOINT;s3Params.s3ForcePathStyle = true;}if (process.env.CDN_ENDPOINT) {(0, _debug.default)("CDN_ENDPOINT:", process.env.CDN_ENDPOINT);}this.s3 = new _s.default({ apiVersion: "2006-03-01", ...s3Params });this.collectionName = `${collectionPrefix}${name}`.trim();this.objectACL = objectACL;this.isPublic = isPublic;}_fileKeyMaker(fileRecord) {const info = fileRecord.infoForCopy(this.name);(0, _debug.default)("S3Store _fileKeyMaker fileRecord info:", info);(0, _debug.default)("S3Store _fileKeyMaker fileRecord size:", fileRecord.size());const result = { _id: info.key || fileRecord._id, filename: info.name || fileRecord.name() || `${fileRecord.collectionName}-${fileRecord._id}`, size: info.size || fileRecord.size(), // I want to separate assets by shopId
      shopId: fileRecord.metadata.shopId };(0, _debug.default)("S3Store _fileKeyMaker result:", result);return result;} /**
                                                                                                                         * This retrieves objects from S3 and sends them to reaction-file-collections as a readable stream.
                                                                                                                         * The whole point of using S3 being hitting your content's URLs, either directly or through a CDN,
                                                                                                                         * this might not be what you're looking for. It's there to preserve reaction-file-collection's default
                                                                                                                         * behavior.
                                                                                                                         */async _getReadStream(fileKey, { start: startPos, end: endPos } = {}) {(0, _debug.default)("S3Store _getReadStream");const opts = { Bucket: process.env.AWS_S3_BUCKET, Key: fileKey._id }; // Add range if this should be a partial read
    if (typeof startPos === "number" && typeof endPos === "number") {opts.Range = `bytes=${startPos}-${endPos}`;}(0, _debug.default)("S3Store _getReadStream opts:", opts);const object = await this.s3.getObject(opts).promise();(0, _debug.default)("S3Store _getReadStream got object:", object);let totalTransferredData = 0;const stream = new _stream.Readable({ read: size => {(0, _debug.default)(`S3Store read body from ${totalTransferredData} to ${totalTransferredData + size}`);const body = object.Body.slice(totalTransferredData, totalTransferredData + size);totalTransferredData += size;(0, _debug.default)(`S3Store _getReadStream transferred ${totalTransferredData}`);stream.push(body);if (typeof endPos === "number" && totalTransferredData >= endPos || totalTransferredData >= fileKey.size) {(0, _debug.default)("S3Store _getReadStream ending stream");stream.push(null);}} });return stream;}async _getWriteStream(fileKey, options = {}) {// it's pretty usefull separate assets by shop. My only concern is that we are using shopId without opaque it.
    const key = `${fileKey.shopId}/${Date.now()}-${fileKey.filename}`; // set externalUrl if the bucket is public
    const externalUrl = this.isPublic ? `${process.env.CDN_ENDPOINT}/${key}` : null;const opts = { Bucket: process.env.AWS_S3_BUCKET, Key: key };(0, _debug.default)("S3Store _getWriteStream opts:", opts);(0, _debug.default)("S3Store _getWriteStream options:", options);(0, _debug.default)("S3Store _getWriteStream fileKey:", fileKey);(0, _debug.default)("S3Store _getWriteStream objectACL", this.objectACL);(0, _debug.default)("S3Store _getWriteStream externalUrl", externalUrl);let uploadId = "";const uploadData = await this.s3.createMultipartUpload({ ...opts, ACL: this.objectACL }).promise();(0, _debug.default)("s3.createMultipartUpload data:", uploadData);if (uploadData.UploadId === undefined) {throw new Error("Couldn't get upload ID from S3");}uploadId = uploadData.UploadId;let partNumber = 1;let totalFileSize = 0;const parts = [];const writeStream = new _stream.Writable({ write: async (chunk, encoding, callback) => {const partData = await this.s3.uploadPart({ ...opts, Body: chunk, UploadId: uploadId, PartNumber: partNumber }).promise();parts.push({ ETag: partData.ETag, PartNumber: partNumber });(0, _debug.default)(`Part ${partNumber} successfully uploaded`, parts);partNumber += 1;totalFileSize += chunk.length;callback();} });writeStream.on("finish", async () => {(0, _debug.default)("S3Store writeStream finish");(0, _debug.default)("S3Store writeStream totalFileSize:", totalFileSize);const uploadedFile = await this.s3.completeMultipartUpload({ ...opts, UploadId: uploadId, MultipartUpload: { Parts: parts } }).promise();(0, _debug.default)("S3 multipart upload completed", uploadedFile); // Emit end and return the fileKey, size, and updated date
      writeStream.emit("stored", { // Set the generated _id so that we know it for future reads and writes.
        // We store the _id as a string and only convert to ObjectID right before
        // reading, writing, or deleting.
        fileKey: uploadedFile.Key, storedAt: new Date(), size: totalFileSize, externalUrl });});return writeStream;}_removeFile(fileKey) {(0, _debug.default)("S3Store _removeFile called for fileKey", fileKey);if (!fileKey._id) return Promise.resolve();return new Promise((resolve, reject) => {this.s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: fileKey._id }, (error, result) => {if (error) {reject(error);} else {resolve(result);}});});}}exports.default = S3Store;