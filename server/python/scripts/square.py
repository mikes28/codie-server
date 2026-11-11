# title: Square path
# description: Four 20 cm sides with 90 degree turns.

def run(ctx):
    for _ in range(4):
        ctx.robot.forward(20)
        ctx.robot.turn(90)
    ctx.log("done")
