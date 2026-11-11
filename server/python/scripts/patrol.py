# title: Patrol
# description: Drive forward, turn, repeat — a simple patrol loop.

def run(ctx):
    for _ in range(3):
        ctx.robot.forward(30)
        ctx.robot.turn(120)
    ctx.log("patrol complete")
