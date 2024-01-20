const express = require('express')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'twitterClone.db')
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

const getFollowingPeopleIds=async(username)=>{
  const getFollowingPeople=`SELECT following_user_id 
  FROM follower
  INNER JOIN user
  ON user.user_id=follower.follower.follower_user_id
  WHERE user.username='${username}'`
  const followingPeople=await db.all(getFollowingPeople)
  const arrayOfIds=followingPeople.map(eachUser=>eachUser.following_user_id)
  return arrayOfIds
}

//Tweet access verification

const tweetAccessVerification=async(request,response,next)=>{
  const {userId}=request
  const {tweetId}=request.params
  const getTweet=`SELECT *
  FROM tweet
  INNER JOIN follower
  ON tweet.user_id=follower.following_user_id
  WHERE tweet.tweet_id='${tweetId}'
  AND follower_user_id='${userId}'`
  const tweet=await db.get(getTweet)
  if (tewwt===undefined){
    response.status(401)
    response.send("Invalid Request")
  }else{
    next()
  }
}

const validatePassword = password => password.length > 5

//1.register

app.post('/register', async (request, response) => {
  const {username, password, name, gender} = request.body
  const hashedPassword = await bcrypt.hash(password, 10)
  const selectUser = `SELECT * FROM user WHERE username='${username}'`
  const dbUser = await db.get(selectUser)
  if (dbUser !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (validatePassword) {
      const createUser = `INSERT INTO 
      user(username,password,name,gender)
      VALUES('${username}','${hashedPassword}','${name}','${gender}')`
      const user = await db.run(createUser)
      response.status(200)
      response.send('User created successfully')
    } else {
      response.status(400)
      response.send('Password is too short')
    }
  }
})

//2.login

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUser = `SELECT * FROM user WHERE username='${username}'`
  const dbUser = await db.get(selectUser)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatch === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MST')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//Authenticate Token

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const getToken = request.headers['authorization']
  if (getToken) {
  jwtToken = getToken.split(' ')[1]
}

if (jwtToken) {
  jwt.verify(jwtToken, 'MST', async (error, payload) => {
    if (error) {
      response.status(401)
      response.send('Invalid JWT Token')
    } else {
      request.username = payload.username
      request.userId = payload.userId
      next()
    }
  })
} else {
  response.status(401)
  response.send('Invalid JWT Token')
}

//3.Returns the list of all names of people whom the user follows

app.get('/user/tweets/feed/',authenticateToken, async (request, response) => {
  const {username}=request
  const followingPeopleIds=await getFollowingPeopleIds(username)
  const getTweets=`SELECT
  username,tweet,date_time as dateTime
  FROM user
  INNER JOIN tweet
  ON user.user_id=tweet.user_id
  WHERE user.user_id IN (${followingPeopleIds})
  ORDER BY date_time DESC
  LIMIT 4`
  const tweets=await db.all(getTweets)
  response.send(tweets) 
})

//4.Returns the list of all names of people whom the user follows

app.get('/user/following/',authenticateToken,async(request,response)=>{
  const {username,userId}=request;
  const getFollowingUsers=`SELECT name
  FROM follower
  INNER JOIN user
  ON user.user_id=follower.following_user_id
  WHERE follower_user_id='${user_id}'`
  const followingPeople=await db.all(getFollowingUsers)
  response.send(followingPeople)
})

//5.Returns the list of all names of people who follows the user

app.get('/user/followers/',authenticateToken,async(request,response)=>{
  const {username,userId}=request;
  const getFollowers=`SELECT DISTINCT name
  FROM follower
  INNER JOIN user
  ON user.user_id=follower.follower_user_id
  WHERE following_user_id='${userId}'`
  const followers=await db.all(getFollowers)
  response.send(followers)
})

//6.

app.get('/tweets/:tweetId/',authenticateToken,tweetAccessVerification,async(request,response)=>{
  const {username,userId}=request
  const {tweetId}=request.params
  const getTweet=`SELECT
  tweet,
  (SELECT COUNT() FROM like WHERE tweet_id='${tweetId}') AS likes,
  (SELECT COUNT() FROM reply WHERE tweet_id='${tweetId}') AS replies,
  date_time AS dateTime
  FROM tweet
  WHERE tweet.tweet_id='${tweetId}'`
  const tweet=await db.get(getTweet)
  response.send(tweet)
})

//7.

app.get('/tweets/:tweetId/likes/',authenticateToken,tweetAccessVerification,async(request,response)=>{
  const {tweetId}=request.params
  const getLikes=`SELECT username
  FROM user
  INNER JOIN like
  ON user.user_id=like.user_id
  WHERE tweet_id='${tweetId}'`
  const likedUsers=await db.all(getLikes)
  const userArray=likedUsers.map(eachUser=>eachUser.username)
  response.send({likes:userArray})
})

//8.

app.get('/tweets/:tweetId/replies/',authenticateToken,tweetAccessVerification,async(request,response)=>{
  const {tweetId}=request.params
  const getReplied=`SELECT name,reply
  FROM user
  INNER JOIN reply
  ON user.user_id=reply.user_id
  WHERE tweet_id='${tweetId}'`
  const repliedUsers=await db.all(getReplied)
  response.send({replies:repliedUsers})
})

//9.

app.get('/user/tweets/',authenticateToken,async(request,response)=>{
  const {userId}=request;
  const getTweets=`SELECT tweet,
  COUNT(DISTINCT like_id) AS likes,
  COUNT(DISTINCT reply_id) AS replies,
  date_time AS dateTime
  FROM tweet LEFT JOIN reply ON tweet.tweet_id=reply.tweet_id
  LEFT JOIN like ON tweet.tweet_d=like.tweet_id
  WHERE tweet.user_id=${userId}
  GROUP BY tweet.tweet_id`
  const tweets=await db.all(getTweets)
  response.send(tweets)
})

//10.

app.post('/user/tweets/',authenticateToken,async(request,response)=>{
  const {tweet}=request.body;
  const userId=parseInt(request.user_id)
  const dateTime=new Date().toJSON().substring(0,19).replace("T"," ")
  const createTweet=`INSERT INTO tweet(tweet,user_id,date_time)
  VALUES('${tweet}','${userId}','${dateTime}')`
  await db.run(createTweet)
  response.send("Created a Tweet")
})

//11.

app.delete('/tweets/:tweetId/',authenticateToken,async(request,response)=>{
  const{tweetId}=request.params
  const{userId}=request
  const getTheTweet=`SELECT * FROM tweet
  WHERE user_id='${userId}'
  AND tweet_id='${tweetId}'`
  const tweet=await db.get(getTheTweet)
  if (tweet===undefined){
    response.status(401)
    response.send("Invalid Request")
  }else{
    const deleteTweet=`DELETE FROM tweet WHERE tweet_id='${tweetId}'`
    await db.run(deleteTweet)
    response.send("Tweet Removed")
  }
});
