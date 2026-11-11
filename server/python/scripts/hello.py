# title: Hello
# description: Beep and light up as a greeting.

def run(ctx):
    ctx.robot.beep(300)
    ctx.wait(400)
    ctx.robot.led("green")
    ctx.log("hello")
