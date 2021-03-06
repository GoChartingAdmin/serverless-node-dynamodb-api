import { DynamoDB } from 'aws-sdk';
import * as moment from 'moment';
import * as uuidv4 from 'uuid/v4';

import Item from './Item';
import ResponseError from './ResponseError';

const db = process.env.IS_OFFLINE ?
  new DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: `http://localhost:${process.env.DYNAMODB_PORT}`,
  }) :
  new DynamoDB.DocumentClient();

export async function getItems(userId: string): Promise<Item[]> {
  const params = {
    TableName: 'items',
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
    },
  };

  const data = await db.query(params).promise();

  return data.Items as Item[];
}

export async function getItemById(userId: string, itemId: string): Promise<Item> {
  const params = {
    TableName: 'items',
    Key: {
      id: itemId,
      userId,
    },
  };

  const data = await db.get(params).promise();

  if (data.Item === undefined) {
    const notFoundError = new Error(`An item could not be found with id: ${itemId}`) as ResponseError;
    
    notFoundError.responseStatusCode = 404;

    throw notFoundError;
  }

  return data.Item as Item;
}

export async function createItem(userId: string, name: string): Promise<Item> {
  const params = {
    TableName: 'items',
    ConditionExpression: 'attribute_not_exists(id) AND attribute_not_exists(userId)',
    Item: {
      id: uuidv4(),
      userId,
      name,
      createdUtc: moment().utc().toISOString(),
    },
  };

  await db.put(params).promise();

  return params.Item;
}

export async function updateItem(userId: string, itemId: string, name: string): Promise<void> {
  try {
    const params = {
      TableName: 'items',
      ReturnValues: 'NONE',
      ConditionExpression: 'attribute_exists(id) AND attribute_exists(userId)',
      UpdateExpression: 'SET #name = :name',
      Key: {
        id: itemId,
        userId,
      },
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      ExpressionAttributeValues: {
        ':name': name,
      },
    };

    console.log(params);

    await db.update(params).promise();
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      const notFoundError = new Error(`An item could not be found with id: ${itemId}`) as ResponseError;

      notFoundError.responseStatusCode = 404;

      throw notFoundError;
    }

    throw err;
  }
}

export async function deleteItem(userId: string, itemId: string): Promise<void> {
  try {
    const params = {
      TableName: 'items',
      ConditionExpression: 'attribute_exists(id) AND attribute_exists(userId)',
      Key: {
        id: itemId,
        userId,
      },
    };

    await db.delete(params).promise();
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      const notFoundError = new Error(`An item could not be found with id: ${itemId}`) as ResponseError;

      notFoundError.responseStatusCode = 404;

      throw notFoundError;
    }

    throw err;
  }
}
