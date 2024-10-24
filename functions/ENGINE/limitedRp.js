const { EmbedBuilder } = require('discord.js');

let leaderboardMessage;
const leaderboardChannel = await client.channels.fetch(config.reducedRP.leaderboardChannel);

let users = [];

async function postLeaderboard() {
  //const leaderboardChannel = await client.channels.fetch(config.reducedRP.leaderboardChannel);

  const fields = users
      .sort((a, b) => b.points - a.points)
      // discord field limit
      .slice(0, 25)
      .map((entry) => ({ name: `${entry.id}`, value: `<@${entry.id}>\nPoints: ${entry.points}\nWarning-Level: ${entry.warnLevel}` }));
  const embed = new EmbedBuilder()
      .setTitle('RP Leaderboard')
      .setColor(users.filter((entry) => entry.warnLevel !== 0).length === 0 ? 'Green' : 'Orange')
      .addFields([...fields]);
  if (!leaderboardMessage) return leaderboardMessage = await leaderboardChannel.send({ embeds: [embed] });
  return leaderboardMessage.edit({ embeds: [embed] });
}

module.exports.run = async (message) => {
  // check messages for all rp messages and convert them to points
  const rpRegex = /(?:\w*)[*_]{1,2}.*?[*_]{1,2}(?:\w*)/gm;
  const findings = message.cleanContent.match(rpRegex);
  if (!findings) return;
  let points = 0;

  const id = message.author.id;
  const user = users.find((user) => user.id === id);

  // Checking if user is already level warning 3. If so, delete message.
  if(user && user.warnLevel === 3)
    message.delete();
  else // Or we just add points
    points = findings.join().length;

  // check if there is a user already to add the points to and check warnings.
  if (user) {
    user.points += points;
  } else {
    await users.push({
      id,
      points,
      warnLevel: 0,
      timeoutLevel: 0,
      timeouts: [0, 0, 0],
      messageTimeout: 0,
      messageID: 0,
      lastPointsDeletion: Date.now(),
    });
  }

  // Update point counts
  users.forEach((user) => {
    const activeUser = users.find((userTemp) => userTemp.id === user.id);

    // check how often the deletion time fits into lastPointsDeletion
    const difference = Date.now() - user.lastPointsDeletion;
    const points = Math.round(difference / config.reducedRP.pointsDeletionTime);
    // remove that amount of points
    activeUser.points -= points;
    // check if points go into negative and delete entire entry and return
    if (Math.sign(activeUser.points) === -1) return users = users.filter((userTemp) => userTemp.id !== user.id);
    // if points drop under threshold, reset warn
    if (activeUser.points < config.reducedRP.warnThreshold) activeUser.warned = false;

    // set warn levels
    config.reducedRP.warnThresholds.every(async (threshold, i) => {
      // add warn level
      if (activeUser.points >= threshold) {
        // only step one warn at the time
        if (activeUser.warnLevel >= (i + 1)) return true;
        // overflow protection
        if (activeUser.warnLevel === config.reducedRP.warnThresholds.length) return true;
        activeUser.warnLevel += 1;
        // reset points to warn threshold, so it fair and user goes through each stage
        activeUser.points = config.reducedRP.warnThresholds[activeUser.warnLevel - 1];
        // TODO: Inform user (DrakEmono starting it)
        // Checking the level of latest warning that has been made to the user
        if(activeUser.timeoutLevel >= activeUser.warnLevel) {
          // Removing the timeout to lower the timeoutLevel variable
          clearTimeout(activeUser.timeouts[activeUser.warnLevel - 1]);
          return false;
        }
        activeUser.timeoutLevel++;
        // Posting the warning for a specific user
        let description = '',
            color = '';
        switch(activeUser.timeoutLevel) {
          case 1:
            description = `<@${activeUser.id}> reached the first warning level!`;
            color = 'Green';
            break;
          case 2:
            description = `<@${activeUser.id}> reached the second warning level!`;
            color = 'Orange';
            break;
          case 3:
            description = `<@${activeUser.id}> reached the third warning level! (No RP anymore for now)`;
            color = 'Red';
        }
        const embed = new EmbedBuilder()
            .setTitle('Warning level reached')
            .setDescription(description)
            .setFooter({
              text: 'No repercussion, just unable to send RP posts at third level!',
            })
            .setColor(color)

        // If there is still a message warning the user that hasn't been deleted yet, we delete it to replace it with a new one
        if(activeUser.messageID) {
          activeUser.messageID.delete();
          activeUser.messageID = null;
          clearTimeout(activeUser.messageTimeout);
        }

        // Message to warn the user
        activeUser.messageID = await leaderboardChannel.send({ embeds: [embed] });
        activeUser.messageTimeout = setTimeout(() => {
          activeUser.messageID.delete();
          activeUser.messageID = null;
        }, 5 * 60000); // 5 minutes
        return false;
      }
      // remove warn level, if above statement is false. Don't ask me how, but it happens to work ¯\_(ツ)_/¯
      // Drake: Actually, I can explain if you're curious to know o.=.o I understood how it works
      if (activeUser.warnLevel === (i + 1)) {
        // underflow protection
        if (activeUser.warnLevel === 0) return false;
        activeUser.warnLevel -= 1;
        // Leaving some time before counting the decreasing level to avoid spamming warnings in case score goes up and down
        activeUser.timeouts[activeUser.warnLevel] = setTimeout(() => activeUser.timeoutLevel--, 30 * 60000); // 30 minutes
        return false;
      }
      return true;
    });

    // update lastPointsDeletion when points where adjusted
    if (points !== 0) activeUser.lastPointsDeletion = Date.now();
  });
  // TEMP: get testing report channel
  await postLeaderboard();
};

module.exports.help = {
  name: 'ENGINE_limitedRp',
};
